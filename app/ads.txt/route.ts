// Serves /ads.txt for Google AdSense. Auto-fills the publisher ID from env,
// so there is nothing to hand-edit. Prerendered at build time.
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // e.g. ca-pub-1234567890123456
  const body = client
    ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : "";
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
