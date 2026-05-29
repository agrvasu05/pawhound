import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium text-stone-600">
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 transition hover:bg-stone-100 hover:text-stone-900"
          >
            All Guides
          </Link>
          <Link
            href="/about"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 hover:text-stone-900 sm:inline-block"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
