/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;

type Runtime = import("@astrojs/cloudflare").Runtime<{
  DB: D1Database;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}

declare module "cloudflare:workers" {
  export interface Env {
    DB: D1Database;
    SESSION_LIMITER?: any;
    WEBHOOK_BURST_LIMITER?: any;
    TURNSTILE_SECRET_KEY?: string;
    RESEND_API_KEY?: string;
  }
}
