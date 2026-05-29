import Link from "next/link";

/**
 * Value Finds Daily logo — a magnifying glass discovering a gold "find"
 * (a faceted spark). Ties to the brand ("Finds") and the search feature.
 * Niche-agnostic so it works across dogs, home, and future categories.
 */

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-2xl shadow-md ring-1 ring-emerald-950/10 ${className}`}
      style={{
        background:
          "radial-gradient(125% 125% at 26% 20%, #34a76a 0%, #1f7a4d 46%, #0d4a2d 100%)",
      }}
    >
      {/* top-left sheen for depth */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 48% at 28% 22%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 68%)",
        }}
      />
      <svg
        viewBox="0 0 48 48"
        className="relative h-[64%] w-[64%]"
        aria-hidden="true"
      >
        {/* lens */}
        <circle
          cx="20"
          cy="20"
          r="12.5"
          fill="rgba(255,255,255,0.10)"
          stroke="#ffffff"
          strokeWidth="3.8"
        />
        {/* handle */}
        <path
          d="M28.9 28.9 L39 39"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* gold "find" spark inside the lens */}
        <path
          d="M20 12.4c.55 4.3 2.9 6.65 7.2 7.2-4.3.55-6.65 2.9-7.2 7.2-.55-4.3-2.9-6.65-7.2-7.2 4.3-.55 6.65-2.9 7.2-7.2Z"
          fill="#ffd166"
        />
        {/* tiny secondary glint */}
        <circle cx="14.6" cy="14.6" r="1.5" fill="#ffffff" opacity="0.85" />
      </svg>
    </span>
  );
}

export default function Logo({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[1.35rem] font-bold tracking-tight ${
            light ? "text-white" : "text-stone-900"
          }`}
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Value Finds
        </span>
        <span
          className={`text-[0.62rem] font-semibold uppercase tracking-[0.32em] ${
            light ? "text-emerald-200" : "text-emerald-700"
          }`}
        >
          Daily
        </span>
      </span>
    </Link>
  );
}
