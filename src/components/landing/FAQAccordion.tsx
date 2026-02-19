"use client";

import { useState } from "react";

const FAQ = [
  {
    q: "Is my pipeline data used to train public models?",
    a: "No. Your data stays in your workspace. Robin is stateful for your pipeline only—we never use your deal flow or transcripts to train public models.",
  },
  {
    q: "How accurate is the triage vs. my own judgment?",
    a: "Robin is tuned to your bar (thesis, tone, past memos). We recommend using it as a first-pass filter and overriding when your gut disagrees. Most users report 80%+ alignment after calibration.",
  },
  {
    q: "Can I customize the bar and rejection message?",
    a: "Yes. You set filter strictness (1–5), request types you accept, turn count, and a custom rejection message. Your link reflects your exact criteria.",
  },
  {
    q: "What about data privacy and security?",
    a: "Transcripts and pipeline data are encrypted in transit and at rest. We are SOC 2 compliant and do not sell or share your data.",
  },
];

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {FAQ.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-700/80 bg-slate-800/30 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-700/30 transition-colors"
          >
            {item.q}
            <span className="text-cyan-400 shrink-0 ml-2">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-3.5 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-2">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
