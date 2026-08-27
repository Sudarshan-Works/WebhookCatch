import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async () => {
  const db = env.DB;

  // Generate a secure random ID (12 chars, URL-safe)
  const array = new Uint8Array(9);
  crypto.getRandomValues(array);
  const id = Array.from(array)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);

  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  await db
    .prepare(
      "INSERT INTO sessions (id, created_at, expires_at, request_count) VALUES (?, ?, ?, 0)"
    )
    .bind(id, now, expiresAt)
    .run();

  return new Response(
    JSON.stringify({
      id,
      created_at: now,
      expires_at: expiresAt,
      request_count: 0,
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
};
