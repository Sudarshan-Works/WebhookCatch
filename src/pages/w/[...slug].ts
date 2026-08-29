import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { SECURITY_CONFIG } from "../../config/security";

// Catch ALL methods
const handler: APIRoute = async ({ params, request }) => {
  if (SECURITY_CONFIG.CIRCUIT_BREAKER_ACTIVE) {
    return new Response(JSON.stringify({ ok: false, error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  const db = (env as any).DB;
  const limiter = (env as any).WEBHOOK_BURST_LIMITER;

  // Enforce IP Burst Rate Limit if bound
  if (limiter) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await limiter.limit({ key: ip });
    if (!success) {
      return new Response(JSON.stringify({ ok: false, error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Enforce Payload Size Limit
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > SECURITY_CONFIG.MAX_REQUEST_BODY_SIZE) {
    return new Response(JSON.stringify({ ok: false, error: "Payload Too Large. Maximum size is 1MB." }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  // The slug will be like "1x2g2y5c6l0e/some/path" or just "1x2g2y5c6l0e"
  const slug = params.slug || "";
  const parts = slug.split('/');
  const sessionId = parts[0];

  // We capture the raw URL pathname for the DB record
  const url = new URL(request.url);
  const path = url.pathname; // This will be e.g. /w/1x2g2y5c6l0e/foo

  // Check session exists
  const session = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  if (!session) {
    return new Response(
      JSON.stringify({ ok: false, error: "Webhook URL not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check expired - enforce cleanup synchronously
  if (Date.now() > (session.expires_at as number)) {
    // Session is expired, delete it (and cascade delete requests)
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return new Response(
      JSON.stringify({ ok: false, error: "Webhook URL has expired" }),
      {
        status: 410,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check request limit
  if ((session.request_count as number) >= 500) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Request limit reached (500 requests)",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Handle mock server delays
  if (session.custom_delay && (session.custom_delay as number) > 0) {
    // Artificial delay
    await new Promise((resolve) => setTimeout(resolve, session.custom_delay as number));
  }

  // Collect headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Collect query parameters
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Collect body with strict memory size limits
  let body = "";
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let bytesRead = 0;
      let isDone = false;
      
      while (!isDone) {
        const { value, done } = await reader.read();
        isDone = done;
        if (value) {
          bytesRead += value.byteLength;
          if (bytesRead > SECURITY_CONFIG.MAX_REQUEST_BODY_SIZE) {
            await reader.cancel("Payload Too Large");
            return new Response(JSON.stringify({ ok: false, error: "Payload Too Large. Maximum size is 1MB." }), {
              status: 413,
              headers: { "Content-Type": "application/json" }
            });
          }
          body += decoder.decode(value, { stream: !isDone });
        }
      }
    }
  } catch (e) {
    console.error("Error reading body:", e);
    // Ignore partial read errors and keep whatever was read
  }

  const now = Date.now();

  // Insert request
  await db
    .prepare(
      "INSERT INTO requests (session_id, method, path, headers, query, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(sessionId, request.method, path, JSON.stringify(headers), JSON.stringify(query), body, now)
    .run();

  // Increment request count
  await db
    .prepare("UPDATE sessions SET request_count = request_count + 1 WHERE id = ?")
    .bind(sessionId)
    .run();

  // Prepare custom mock response
  const responseStatus = (session.custom_status as number) || 200;
  const responseBody = session.custom_body
    ? (session.custom_body as string)
    : JSON.stringify({ ok: true, message: "Request captured" });

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "*",
  };

  if (session.custom_headers) {
    try {
      const parsedCustomHeaders = JSON.parse(session.custom_headers as string);
      for (const [k, v] of Object.entries(parsedCustomHeaders)) {
        responseHeaders[k] = v as string;
      }
    } catch (e) {
      // Ignore invalid headers
    }
  }

  return new Response(responseBody, {
    status: responseStatus,
    headers: responseHeaders,
  });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;

export const ALL = handler;
