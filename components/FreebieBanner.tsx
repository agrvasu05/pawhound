import Link from "next/link";

// In-content lead-magnet CTA — turns article readers into email subscribers.
export default function FreebieBanner() {
  return (
    <aside className="my-8 rounded-2xl border border-[#e7d8c4] bg-[#f7efe4] p-6 sm:flex sm:items-center sm:gap-6">
      <div className="flex-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b05a3c]">Free printable</p>
        <h2 className="mb-1 text-xl font-bold text-stone-900">The Cozy Home Reset</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          A 7-day checklist to a warmer, calmer home in 15 minutes a day. Grab it free →
        </p>
      </div>
      <Link
        href="/freebie"
        className="mt-4 inline-block whitespace-nowrap rounded-full bg-[#b05a3c] px-6 py-3 font-semibold text-white no-underline hover:bg-[#9c4f34] sm:mt-0"
      >
        Get the free printable
      </Link>
    </aside>
  );
}
