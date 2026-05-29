"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Item = {
  slug: string;
  title: string;
  niche: string;
  noun: string;
  count: number;
  intro: string;
};

const NICHE_LABEL: Record<string, string> = {
  dogs: "Dogs",
  home: "Home",
};

export default function SearchBar() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Lazy-load the index the first time the user interacts.
  function load() {
    if (items !== null) return;
    fetch("/search-index.json")
      .then((r) => r.json())
      .then((d: Item[]) => setItems(d))
      .catch(() => setItems([]));
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query || !items) return [];
    const starts: Item[] = [];
    const contains: Item[] = [];
    for (const it of items) {
      const t = it.title.toLowerCase();
      if (t.startsWith(query)) starts.push(it);
      else if (t.includes(query) || it.intro.toLowerCase().includes(query))
        contains.push(it);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query, items]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      const pick = results[active];
      if (pick) window.location.href = `/${pick.slug}`;
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-stone-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => {
            load();
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            load();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search guides…"
          aria-label="Search guides"
          className="w-28 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none sm:w-40 sm:focus:w-52"
          style={{ transition: "width 0.2s ease" }}
        />
      </div>

      {open && query.length > 0 && (
        <div className="absolute right-0 z-50 mt-2 w-[20rem] max-w-[85vw] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-stone-400">
              {items === null ? "Loading…" : `No guides match “${q.trim()}”`}
            </div>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={r.slug}>
                  <Link
                    href={`/${r.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-start gap-3 px-4 py-2.5 transition ${
                      i === active ? "bg-emerald-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700">
                      {NICHE_LABEL[r.niche] ?? r.niche}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-stone-800">
                        {r.title}
                      </span>
                      <span className="text-xs text-stone-400">
                        {r.count} {r.noun} ranked
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
