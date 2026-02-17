"use client";

const STEPS = [
  { label: "Extracting claims…", layer: 1 },
  { label: "Cross-referencing streams…", layer: 2 },
  { label: "Running GRUE analysis…", layer: 3 },
  { label: "Building interrogation…", layer: 4 },
];

export default function PipelineProgress({ current = 0 }: { current?: number }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-3">
        <h2 className="text-lg font-medium text-zinc-300 text-center mb-2">
          Analyzing your input…
        </h2>
        <p className="text-zinc-500 text-sm text-center mb-8">
          Robin is loading the interrogation.
        </p>
        {STEPS.map((step, i) => (
          <div
            key={step.layer}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-colors ${
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
            <span className={i <= current ? "text-zinc-200" : "text-zinc-500"}>
              Layer {step.layer}: {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
