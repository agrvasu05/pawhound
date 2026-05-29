import Link from "next/link";
import { LogoMark } from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span
              className="text-lg font-bold text-stone-800"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              Value Finds Daily
            </span>
          </div>
          <p className="max-w-md text-sm text-stone-500">
            Honest, hand-picked guides — dog breeds, cozy home ideas, and more.
            New finds every day.
          </p>
          <nav className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-stone-500">
            <Link href="/about" className="transition hover:text-emerald-700">About</Link>
            <Link href="/privacy" className="transition hover:text-emerald-700">Privacy</Link>
            <Link href="/terms" className="transition hover:text-emerald-700">Terms</Link>
            <Link href="/contact" className="transition hover:text-emerald-700">Contact</Link>
            <Link href="/attribution" className="transition hover:text-emerald-700">Image Credits</Link>
          </nav>
          <p className="mt-4 text-xs text-stone-400">
            © {new Date().getFullYear()} Value Finds Daily. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
