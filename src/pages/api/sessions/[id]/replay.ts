import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { fetchSecure } from "../../../../utils/ssrf";

export const POST: APIRoute = async ({ params, request }) => {
  const db = env.DB;
  const sessionId = params.id;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session ID" }), { status: 400 });
  }

  // 1. Verify session exists and limits
  const session = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  if (Date.now() > (session.expires_at as number)) {
    return new Response(JSON.stringify({ error: "Session expired" }), { status: 410 });
  }

  if ((session.replay_count as number) >= 50) {
    return new Response(JSON.stringify({ error: "Replay limit reached (50 max)" }), { status: 429 });
  }

  // 2. Parse request payload
  let payload: any;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
  }

  const { url, method, headers, query, body } = payload;
  if (!url || !method) {
    return new Response(JSON.stringify({ error: "Missing url or method" }), { status: 400 });
  }

  // 3. Construct the outgoing URL
  let targetUrl = url;
  if (query && Object.keys(query).length > 0) {
    try {
      const u = new URL(url);
      for (const [k, v] of Object.entries(query)) {
        u.searchParams.append(k, String(v));
      }
      targetUrl = u.toString();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid target URL format" }), { status: 400 });
    }
  }

  // Sanitize headers
  const outgoingHeaders = new Headers();
  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== 'host' && k.toLowerCase() !== 'content-length') {
        outgoingHeaders.set(k, String(v));
      }
    }
  }

  const fetchOptions: RequestInit = {
    method,
    headers: outgoingHeaders,
  };

  if (method !== 'GET' && method !== 'HEAD' && body) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // 4. Increment replay count
  await db
    .prepare("UPDATE sessions SET replay_count = replay_count + 1 WHERE id = ?")
    .bind(sessionId)
    .run();

  // 5. Execute secure fetch
  const { response, error, timeMs } = await fetchSecure(targetUrl, fetchOptions);

  if (error) {
    return new Response(JSON.stringify({
      success: false,
      error,
      timeMs
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!response) {
    return new Response(JSON.stringify({
      success: false,
      error: "Unknown error",
      timeMs
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 6. Gather response data
  const resHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    resHeaders[k] = v;
  });

  let resBody = "";
  try {
    resBody = await response.text();
  } catch (err) {
    resBody = "[Error reading body or body too large]";
  }

  return new Response(JSON.stringify({
    success: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
    body: resBody,
    timeMs
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
