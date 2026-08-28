import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { SECURITY_CONFIG } from "../../config/security";

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;
  const limiter = env.SESSION_LIMITER;

  // 1. Determine Fingerprint
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + userAgent + "webhookcatch_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);

  // 2. Enforce General Rate Limiting
  if (limiter) {
    const { success } = await limiter.limit({ key: fingerprint });
    if (!success) {
      return new Response(JSON.stringify({ ok: false, error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // 3. Check Session Creation limits for today
  const today = new Date();
  today.setUTCHours(0,0,0,0);
  const todayMs = today.getTime();
  
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE ip_fingerprint = ? AND created_at > ?")
    .bind(fingerprint, todayMs)
    .first();
    
  const count = (result?.count as number) || 0;

  if (count >= SECURITY_CONFIG.MAX_SESSIONS_PER_IP_DAY) {
    return new Response(JSON.stringify({ ok: false, error: "Daily session limit reached." }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 4. Check Turnstile if suspicious
  if (count >= SECURITY_CONFIG.TURNSTILE_TRIGGER_THRESHOLD) {
    let turnstileToken = "";
    try {
      const body = await request.clone().json() as any;
      turnstileToken = body.turnstileToken;
    } catch {}

    if (!turnstileToken) {
      return new Response(JSON.stringify({ ok: false, error: "Challenge Required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Verify Turnstile
    const secretKey = env.TURNSTILE_SECRET_KEY;
    if (secretKey) {
      const formData = new FormData();
      formData.append("secret", secretKey);
      formData.append("response", turnstileToken);
      formData.append("remoteip", ip);
      
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
      });
      const outcome = await res.json() as any;
      if (!outcome.success) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid Turnstile token" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }

  // Generate a cryptographically secure UUID v4
  const id = crypto.randomUUID();

  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  await db
    .prepare(
      "INSERT INTO sessions (id, created_at, expires_at, request_count, ip_fingerprint) VALUES (?, ?, ?, 0, ?)"
    )
    .bind(id, now, expiresAt, fingerprint)
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
