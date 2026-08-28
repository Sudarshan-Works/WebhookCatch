import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = (env as any).RESEND_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Email service is not configured (Missing RESEND_API_KEY)" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json() as any;
    const { email, query, screenshot } = body;

    if (!email || !query) {
      return new Response(JSON.stringify({ error: "Email and query are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resendPayload: any = {
      from: "WebhookCatch Support <onboarding@resend.dev>", // Resend test domain (you will update this once you verify your own domain in Resend)
      to: ["contact@webhookcatch.com"],
      subject: `New Support Request from ${email}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>From:</strong> ${email}</p>
        <hr />
        <h3>Query:</h3>
        <p style="white-space: pre-wrap;">${query}</p>
      `,
    };

    if (screenshot && screenshot.content) {
      resendPayload.attachments = [
        {
          filename: screenshot.filename || 'screenshot.png',
          content: screenshot.content, // Base64 content
        }
      ];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resendPayload)
    });

    if (!res.ok) {
      const errorData = await res.json() as any;
      console.error("Resend API Error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to send email via provider." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
