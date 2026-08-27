import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// Catch ALL methods
const handler: APIRoute = async ({ params, request }) => {
  const db = env.DB;
  const sessionId = params.id;

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

  // Check expired
  if (Date.now() > (session.expires_at as number)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Webhook URL has expired" }),
      {
        status: 410,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check request limit
  if ((session.request_count as number) >= 100) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Request limit reached (100 requests)",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Collect headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Collect query parameters
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Collect body
  let body = "";
  try {
    body = await request.text();
  } catch {
    body = "";
  }

  const now = Date.now();

  // Insert request
  await db
    .prepare(
      "INSERT INTO requests (session_id, method, headers, query, body, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(sessionId, request.method, JSON.stringify(headers), JSON.stringify(query), body, now)
    .run();

  // Increment request count
  await db
    .prepare("UPDATE sessions SET request_count = request_count + 1 WHERE id = ?")
    .bind(sessionId)
    .run();

  return new Response(
    JSON.stringify({ ok: true, message: "Request captured" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "*",
      },
    }
  );
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;

export const ALL = handler;
