"use client";

import Link from "next/link";

export default function AppNav() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
      <Link
        href="/app"
        className="text-sm font-semibold tracking-tight text-zinc-100 hover:text-cyan-400 transition-colors"
      >
        PitchRobin
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/app/deals" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          Deals
        </Link>
        <Link href="/app/insights" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          Insights
        </Link>
        <Link href="/app/settings/profile" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          Settings
        </Link>
      </nav>
    </header>
  );
}
