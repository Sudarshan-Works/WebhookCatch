import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params, request }) => {
  const db = env.DB;
  const sessionId = params.id;

  let isCancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastCount = -1;

      // Send initial heartbeat to establish connection immediately
      controller.enqueue(`event: ping\ndata: ok\n\n`);

      while (!isCancelled) {
        try {
          // Check session and count
          const session = await db
            .prepare("SELECT request_count, expires_at FROM sessions WHERE id = ?")
            .bind(sessionId)
            .first();

          if (!session || Date.now() > (session.expires_at as number)) {
            controller.enqueue(`event: error\ndata: Session expired or not found\n\n`);
            controller.close();
            break;
          }

          const currentCount = session.request_count as number;

          // If new requests arrived, fetch and send the state
          if (currentCount !== lastCount) {
            lastCount = currentCount;
            
            const requests = await db
              .prepare(
                "SELECT * FROM requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 100"
              )
              .bind(sessionId)
              .all();

            const payload = {
              session: {
                request_count: currentCount,
                expires_at: session.expires_at,
              },
              requests: requests.results.map((r: any) => ({
                id: r.id,
                method: r.method,
                headers: JSON.parse(r.headers as string),
                query: JSON.parse(r.query as string),
                body: r.body,
                created_at: r.created_at,
              })),
            };

            controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
          }
        } catch (err) {
          console.error("Stream polling error:", err);
          if (!isCancelled) controller.close();
          break;
        }

        // Wait 1.5 seconds before polling D1 again
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    },
    cancel() {
      isCancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};
