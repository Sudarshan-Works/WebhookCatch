import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params }) => {
  const db = (env as any).DB;
  const sessionId = params.id;

  // Check session exists and is not expired
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

  if (Date.now() > (session.expires_at as number)) {
    return new Response(JSON.stringify({ error: "Session expired" }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch requests for this session, newest first
  const requests = await db
    .prepare(
      "SELECT * FROM requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 100"
    )
    .bind(sessionId)
    .all();

  return new Response(
    JSON.stringify({
      session: {
        id: session.id,
        created_at: session.created_at,
        expires_at: session.expires_at,
        request_count: session.request_count,
      },
      requests: requests.results.map((r: any) => ({
        id: r.id,
        method: r.method,
        path: r.path,
        headers: JSON.parse(r.headers as string),
        query: JSON.parse(r.query as string),
        body: r.body,
        created_at: r.created_at,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
