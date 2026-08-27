import { createExports } from '@astrojs/cloudflare/cf-worker-entrypoint';
// @ts-ignore
import * as server from '../dist/server/entry.mjs';

const handler = createExports(server);

export default {
  async fetch(request: Request, env: any, ctx: any) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(event: any, env: any, ctx: any) {
    const db = env.DB;
    const now = Date.now();
    try {
      console.log(`[Cron] Running scheduled cleanup at ${new Date(now).toISOString()}`);
      
      // Delete all sessions where expires_at is in the past.
      // Thanks to ON DELETE CASCADE on requests, all associated request data is also removed.
      const result = await db
        .prepare("DELETE FROM sessions WHERE expires_at < ?")
        .bind(now)
        .run();
        
      console.log(`[Cron] Cleanup successful. ${result?.meta?.changes || 0} sessions deleted.`);
    } catch (e) {
      console.error("[Cron] Cleanup failed:", e);
    }
  }
};
