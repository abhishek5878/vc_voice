"use client";

import Link from "next/link";

type Mode = 1 | 2 | 3;

const MODES: { mode: Mode; title: string; description: string; bestFor: string }[] = [
  {
    mode: 1,
    title: "Post-Meeting",
    description: "Analyze meeting transcript and your private notes. Get evidence map, conflicts, GRUE, and interrogation.",
    bestFor: "Just had a call; stress-test what was said",
  },
  {
    mode: 2,
    title: "Pre-Meeting Prep",
    description: "Upload pitch material. Get the attack brief: red list, yellow list, and recommended question order.",
    bestFor: "Call tomorrow; get your question list ready",
  },
  {
    mode: 3,
    title: "Pitch Stress-Test",
    description: "Founder mode. Run the pipeline silently, then face the Interrogator in a live session.",
    bestFor: "Founder prepping; harden the pitch before the meeting",
  },
];

export default function ModeSelect({ onStart }: { onStart: (mode: Mode) => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="p-6 border-b border-zinc-800/80 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">PitchRobin</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/app/deals" className="text-zinc-400 hover:text-zinc-200">Deals</Link>
          <Link href="/app/insights" className="text-zinc-400 hover:text-zinc-200">Insights</Link>
        </nav>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
        <p className="text-cyan-500/90 text-sm font-medium uppercase tracking-widest mb-2">Your Investment Bar, Automated.</p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-2 text-center">What are we analyzing?</h2>
        <p className="text-zinc-500 text-sm mb-6 max-w-md text-center">
          Triage inbound requests or stress-test a meeting. Give transcript + optional voice note for the best signal.
        </p>
        <p className="text-xs text-zinc-600 mb-10 max-w-md text-center">
          Tip: bookmark <span className="font-mono text-zinc-500">/app?mode=2</span> for prep, <span className="font-mono text-zinc-500">/app?mode=1</span> for post-call.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl">
          {MODES.map(({ mode, title, description, bestFor }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode)}
              className="card-hover text-left p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-cyan-500/30 hover:bg-zinc-900/80 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Mode {mode}</span>
              <h3 className="text-lg font-semibold text-zinc-100 mt-2">{title}</h3>
              <p className="text-zinc-500 text-sm mt-2 leading-relaxed">{description}</p>
              <p className="text-zinc-600 text-xs mt-2 italic">Best for: {bestFor}</p>
              <span className="inline-block mt-4 text-sm font-medium text-cyan-500/90">Start →</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
