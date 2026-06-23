// Email capture for the lead-magnet funnel. Adds the subscriber to MailerLite
// (when configured) and returns the freebie download link for instant delivery.
// MailerLite's welcome automation (set in dashboard) emails the freebie + starts
// the nurture sequence. Works without a key too (download still served), so the
// page is functional before the ESP is connected — list capture activates the
// moment MAILERLITE_API_KEY is set.

const FREEBIE = "/freebies/cozy-home-reset.pdf";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email = "";
  let source = "freebie";
  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
    source = String(body.source || "freebie").slice(0, 40);
  } catch {
    /* invalid JSON */
  }

  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  const key = process.env.MAILERLITE_API_KEY;
  if (key) {
    try {
      const payload: Record<string, unknown> = { email, fields: { source } };
      const group = process.env.MAILERLITE_GROUP_ID;
      if (group) payload.groups = [group];
      const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error("MailerLite subscribe failed", res.status, (await res.text()).slice(0, 300));
      }
    } catch (err) {
      console.error("MailerLite error:", (err as Error).message);
    }
  }

  // Always deliver the freebie so the UX never breaks.
  return Response.json({ ok: true, download: FREEBIE });
}
