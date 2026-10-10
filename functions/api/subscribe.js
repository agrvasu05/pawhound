// Cloudflare Pages Function: POST /api/subscribe
// Same contract as the old Next route: adds the email to MailerLite (when
// MAILERLITE_API_KEY is set in the Pages project's environment variables) and
// always returns the freebie download link so the form never breaks.
const FREEBIE = "/freebies/cozy-home-reset.pdf";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  let email = "", source = "freebie";
  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
    source = String(body.source || "freebie").slice(0, 40);
  } catch { /* invalid JSON */ }

  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  if (env.MAILERLITE_API_KEY) {
    try {
      const payload = { email, fields: { signup_source: source } };
      if (env.MAILERLITE_GROUP_ID) payload.groups = [env.MAILERLITE_GROUP_ID];
      const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.MAILERLITE_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) console.error("MailerLite subscribe failed", res.status, (await res.text()).slice(0, 300));
    } catch (err) {
      console.error("MailerLite error:", err && err.message);
    }
  }
  return Response.json({ ok: true, download: FREEBIE });
}

export function onRequestGet() {
  return new Response("Method not allowed", { status: 405 });
}
