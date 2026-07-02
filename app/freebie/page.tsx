import SubscribeForm from "@/components/SubscribeForm";
import { getTripwireProduct, shopAsset } from "@/lib/shop";

export const metadata = {
  title: "Free Printable: The Cozy Home Reset (7-Day Checklist)",
  description:
    "Get the free 7-Day Cozy Home Reset printable — a simple daily checklist to make your home warmer, calmer and more beautiful in 15 minutes a day.",
  alternates: { canonical: "/freebie" },
  openGraph: {
    title: "Free Printable: The Cozy Home Reset",
    description: "A 7-day checklist to a warmer, cozier home in 15 minutes a day. Free download.",
    type: "website",
  },
};

export default function FreebiePage() {
  // The $4–6 one-time offer shown right after opt-in (playbook rule 9). The
  // optional NEXT_PUBLIC_TRIPWIRE_CODE appends a Gumroad offer code (create it
  // once in the Gumroad dashboard) so the tripwire can carry a real discount.
  const tw = getTripwireProduct();
  const code = process.env.NEXT_PUBLIC_TRIPWIRE_CODE;
  const offer = tw
    ? {
        title: tw.title,
        price: tw.price,
        url: code ? `${tw.gumroad_url}/${code}` : tw.gumroad_url,
        image: tw.cover ? shopAsset(tw.slug, tw.cover) : null,
      }
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#b05a3c]">Free Printable</p>
      <h1 className="mb-4 text-4xl font-bold leading-tight text-stone-900">The Cozy Home Reset</h1>
      <p className="mb-6 text-lg leading-relaxed text-stone-600">
        A simple <strong>7-day checklist</strong> to make your home feel warmer, calmer and more beautiful —
        in just <strong>15 minutes a day</strong>. No renovation, no big budget. Just print it, stick it on the
        fridge, and check off your way to a home you love.
      </p>

      <ul className="mb-8 space-y-2 text-stone-700">
        <li>✅ One quick, doable focus for each of 7 days</li>
        <li>✅ Room-by-room cozy styling wins</li>
        <li>✅ Notes space to track your before &amp; after</li>
        <li>✅ Instant PDF download — print at home</li>
      </ul>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-center font-medium text-stone-800">
          Enter your email and we&apos;ll send it straight over 👇
        </p>
        <SubscribeForm source="freebie-page" offer={offer} />
        <p className="mt-4 text-center text-xs text-stone-400">
          Free forever. We&apos;ll also send the occasional cozy-home idea — unsubscribe anytime.
        </p>
      </div>
    </main>
  );
}
