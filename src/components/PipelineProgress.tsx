"use client";

const STEPS = [
  { label: "Extracting claims…", layer: 1, tip: "Finding claims and tying each to a source quote (verified / unverified / contradicted)." },
  { label: "Cross-referencing streams…", layer: 2, tip: "Comparing transcript vs your notes for factual conflicts, tone gaps, and omissions." },
  { label: "Running GRUE analysis…", layer: 3, tip: "Checking coverage on growth, retention, unit economics, moat, team—and flagging blind spots." },
  { label: "Building interrogation…", layer: 4, tip: "Turning weak spots into red-list questions (probe hard) and yellow-list follow-ups." },
];

export default function PipelineProgress({ current = 0 }: { current?: number }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-3">
        <h2 className="text-lg font-medium text-zinc-300 text-center mb-2">
          Analyzing your input…
        </h2>
        <p className="text-zinc-500 text-sm text-center mb-8">
          Usually takes 30–60 seconds. Don&apos;t close this page.
        </p>
        {STEPS.map((step, i) => (
          <div
            key={step.layer}
            className={`flex items-start gap-4 px-4 py-3.5 rounded-xl border transition-colors ${
              i <= current
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                i < current
                  ? "bg-amber-500/20 text-amber-400"
                  : i === current
                    ? "bg-amber-500 text-zinc-950"
                    : "bg-zinc-700 text-zinc-500"
              }`}
            >
              {i < current ? "✓" : step.layer}
            </span>
            <div className="min-w-0 flex-1">
              <span className={i <= current ? "text-zinc-200" : "text-zinc-500"}>
                Layer {step.layer}: {step.label}
              </span>
              {i === current && step.tip && (
                <p className="text-xs text-zinc-500 mt-1.5">{step.tip}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
