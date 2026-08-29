import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params, request }) => {
  const db = (env as any).DB;
  const sessionId = params.id;

  let isCancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastCount = -1;
      let emptyPolls = 0;
      let currentSleepMs = 3000; // start at 3s

      // Send initial heartbeat to establish connection immediately
      controller.enqueue(`event: ping\ndata: ok\n\n`);

      while (!isCancelled) {
        try {
          // Check session and count
          const session = await db
            .prepare("SELECT * FROM sessions WHERE id = ?")
            .bind(sessionId)
            .first();

          if (!session || Date.now() > (session.expires_at as number)) {
            controller.enqueue(`event: error\ndata: Session expired or not found\n\n`);
            controller.close();
            break;
          }

          const currentCount = session.request_count as number;
          // Hash settings lightly to detect changes
          const currentSettingsHash = `${session.custom_status}-${session.custom_delay}-${session.custom_headers}-${session.custom_body}`;

          // If new requests arrived or settings changed, fetch and send the state
          if (currentCount !== lastCount || currentSettingsHash !== (controller as any).lastSettingsHash) {
            lastCount = currentCount;
            (controller as any).lastSettingsHash = currentSettingsHash;
            emptyPolls = 0; // reset backoff
            currentSleepMs = 3000;
            
            const requests = await db
              .prepare(
                "SELECT * FROM requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 500"
              )
              .bind(sessionId)
              .all();

            const payload = {
              session: {
                request_count: currentCount,
                expires_at: session.expires_at,
                custom_status: session.custom_status,
                custom_body: session.custom_body,
                custom_headers: session.custom_headers ? JSON.parse(session.custom_headers as string) : null,
                custom_delay: session.custom_delay,
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
            };

            controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
          } else {
            emptyPolls++;
            if (emptyPolls > 10) currentSleepMs = 5000; // After ~30s idle, sleep 5s
            if (emptyPolls > 30) currentSleepMs = 10000; // After ~2m idle, sleep 10s
          }
        } catch (err) {
          console.error("Stream polling error:", err);
          if (!isCancelled) controller.close();
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, currentSleepMs));
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
