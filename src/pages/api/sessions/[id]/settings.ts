import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ params, request }) => {
  const db = env.DB;
  const sessionId = params.id;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { custom_status, custom_body, custom_headers, custom_delay } = body;

  try {
    await db
      .prepare(
        "UPDATE sessions SET custom_status = ?, custom_body = ?, custom_headers = ?, custom_delay = ? WHERE id = ?"
      )
      .bind(
        custom_status || null,
        custom_body || null,
        custom_headers ? JSON.stringify(custom_headers) : null,
        custom_delay || 0,
        sessionId
      )
      .run();

    return new Response(JSON.stringify({ ok: true, message: "Settings updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Failed to update settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
