import Link from "next/link";

/**
 * Value Finds Daily logo — a "spark/find" emblem (a curated-gem sparkle) plus a
 * serif wordmark. Niche-agnostic so it works across dogs, home, and future
 * categories. Uses currentColor where possible so it adapts to dark/light bars.
 */

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl shadow-sm ${className}`}
      style={{
        background: "linear-gradient(135deg, #0f5132 0%, #1f7a4d 60%, #2e9d63 100%)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" aria-hidden="true">
        {/* main sparkle */}
        <path
          d="M12 1.5c.3 4.3 3.9 7.9 8.2 8.2v.6c-4.3.3-7.9 3.9-8.2 8.2h-.6c-.3-4.3-3.9-7.9-8.2-8.2v-.6c4.3-.3 7.9-3.9 8.2-8.2h.6Z"
          fill="#ffffff"
        />
        {/* small accent sparkle */}
        <path
          d="M18.6 14.4c.12 1.7 1.5 3.1 3.2 3.2v.3c-1.7.12-3.1 1.5-3.2 3.2h-.3c-.12-1.7-1.5-3.1-3.2-3.2v-.3c1.7-.12 3.1-1.5 3.2-3.2h.3Z"
          fill="#ffd166"
        />
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
      <LogoMark className="h-9 w-9" />
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
