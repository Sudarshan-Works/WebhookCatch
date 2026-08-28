// SSRF Protection Module

/**
 * Validates whether an IP address belongs to a private/reserved CIDR block.
 * Blocks localhost, private network (RFC 1918), link-local (cloud metadata),
 * and zero/broadcast addresses.
 */
function isPrivateIP(ip: string): boolean {
  if (ip.includes(':')) {
    // Basic IPv6 checks
    if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return true;
    }
    return false;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true; // Invalid format

  const [a, b] = parts;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback / Localhost)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Resolves a hostname to IPs using Cloudflare DNS-over-HTTPS.
 */
async function resolveHostname(hostname: string): Promise<string[]> {
  // If it's already an IP address, just return it
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
  if (isIP) {
    return [hostname];
  }

  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json() as any;
    if (!data.Answer) return [];

    return data.Answer.filter((r: any) => r.type === 1 || r.type === 28).map((r: any) => r.data);
  } catch (error) {
    console.error("DNS Resolution Error:", error);
    return [];
  }
}

/**
 * Checks if a URL is safe to fetch.
 */
async function isUrlSafe(targetUrl: string): Promise<boolean> {
  let urlObj: URL;
  try {
    urlObj = new URL(targetUrl);
  } catch {
    return false; // Invalid URL
  }

  // Enforce HTTP/HTTPS only
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return false;
  }

  const hostname = urlObj.hostname;
  const ips = await resolveHostname(hostname);

  if (ips.length === 0) {
    // If DNS fails to resolve, we cannot guarantee safety (could be a local entry or NXDOMAIN)
    // For strict SSRF protection, we should block it.
    return false;
  }

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      return false; // Blocking if ANY resolved IP is private
    }
  }

  return true;
}

export interface FetchSecureOptions extends RequestInit {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBodySize?: number;
}

/**
 * A wrapper around fetch() that enforces SSRF protections.
 */
export async function fetchSecure(url: string, options: FetchSecureOptions = {}): Promise<{ response: Response | null, error?: string, timeMs: number }> {
  const {
    timeoutMs = 5000,
    maxRedirects = 3,
    maxBodySize = 5 * 1024 * 1024, // 5MB
    ...fetchOpts
  } = options;

  let currentUrl = url;
  let redirectCount = 0;
  let finalResponse: Response | null = null;
  const startTime = Date.now();

  try {
    while (redirectCount <= maxRedirects) {
      // 1. Validate the current URL
      const safe = await isUrlSafe(currentUrl);
      if (!safe) {
        return { response: null, error: `SSRF Blocked: Unsafe destination URL (${currentUrl})`, timeMs: Date.now() - startTime };
      }

      // 2. Setup AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // 3. Make the fetch request (manual redirects so we can validate the next URL)
      const res = await fetch(currentUrl, {
        ...fetchOpts,
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 4. Handle Redirects manually
      if (res.status >= 300 && res.status < 400 && res.headers.has('location')) {
        const location = res.headers.get('location')!;
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        continue;
      }

      finalResponse = res;
      break;
    }

    if (redirectCount > maxRedirects) {
      return { response: null, error: "Too many redirects", timeMs: Date.now() - startTime };
    }

    if (!finalResponse) {
      return { response: null, error: "Empty response", timeMs: Date.now() - startTime };
    }

    // 5. Wrap response body to enforce size limits
    const bodyLimitStream = new TransformStream({
      start() {
        // @ts-ignore
        this.bytesRead = 0;
      },
      transform(chunk, controller) {
        // @ts-ignore
        this.bytesRead += chunk.byteLength;
        // @ts-ignore
        if (this.bytesRead > maxBodySize) {
          controller.error(new Error(`Response exceeded maximum allowed size of ${maxBodySize} bytes.`));
        } else {
          controller.enqueue(chunk);
        }
      }
    });

    let wrappedBody = finalResponse.body;
    if (wrappedBody) {
      wrappedBody = wrappedBody.pipeThrough(bodyLimitStream);
    }

    const safeResponse = new Response(wrappedBody, {
      status: finalResponse.status,
      statusText: finalResponse.statusText,
      headers: finalResponse.headers
    });

    return { response: safeResponse, timeMs: Date.now() - startTime };

  } catch (err: any) {
    let errMsg = err.message || String(err);
    if (err.name === 'AbortError') {
      errMsg = "Request timed out";
    }
    return { response: null, error: errMsg, timeMs: Date.now() - startTime };
  }
}
