"use client";

type Mode = 1 | 2 | 3;

const MODES: { mode: Mode; title: string; description: string }[] = [
  {
    mode: 1,
    title: "Post-Meeting",
    description: "Analyze meeting transcript and your private notes. Get evidence map, conflicts, GRUE, and interrogation.",
  },
  {
    mode: 2,
    title: "Pre-Meeting Prep",
    description: "Upload pitch material. Get the attack brief: red list, yellow list, and recommended question order.",
  },
  {
    mode: 3,
    title: "Pitch Stress-Test",
    description: "Founder mode. Run the pipeline silently, then face the Interrogator in a live session.",
  },
];

export default function ModeSelect({ onStart }: { onStart: (mode: Mode) => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight">Robin.ai</h1>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-medium text-zinc-200 mb-2">What are we analyzing?</h2>
        <p className="text-zinc-500 text-sm mb-10 max-w-md text-center">
          Pro tip: give me both your meeting transcript and your voice note. That&apos;s where the real signal lives.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {MODES.map(({ mode, title, description }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode)}
              className="text-left p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
            >
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                Mode {mode}
              </span>
              <h3 className="text-lg font-semibold text-zinc-100 mt-2">{title}</h3>
              <p className="text-zinc-500 text-sm mt-2">{description}</p>
              <span className="inline-block mt-4 text-sm font-medium text-amber-500/90">Start →</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
