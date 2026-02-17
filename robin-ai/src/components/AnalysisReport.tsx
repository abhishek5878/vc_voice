"use client";

import { useCallback, useState } from "react";
import type { PipelineResult } from "@/lib/pipeline/types";
import { pipelineResultToMarkdown } from "@/lib/reportMarkdown";

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export default function AnalysisReport({
  result,
  onBack,
}: {
  result: PipelineResult;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyMarkdown = useCallback(() => {
    const md = pipelineResultToMarkdown(result);
    void navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const downloadMarkdown = useCallback(() => {
    const md = pipelineResultToMarkdown(result);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `robin-report-mode-${result.mode}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const claims = result.layer_1?.claims ?? [];
  const conflicts = result.layer_2?.conflicts ?? [];
  const layer2Skipped = result.layer_2?.skipped;
  const grue = result.layer_3;
  const red = result.layer_4?.red_list ?? [];
  const yellow = result.layer_4?.yellow_list ?? [];
  const pedigree = result.layer_4?.pedigree_flags ?? [];
  const brief = result.pre_meeting_attack_brief;

  const statusBadge = (status: string) => {
    const cls =
      status === "verified"
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
        : status === "unverified"
          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
          : "bg-red-500/20 text-red-400 border-red-500/40";
    const label = status === "verified" ? "✓ Verified" : status === "unverified" ? "⚠ Unverified" : "✗ Contradicted";
    return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 border-b border-zinc-800 bg-zinc-950/95 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-200 text-sm">
            ← New analysis
          </button>
          <h1 className="text-lg font-semibold">
            Robin.ai — {result.mode === 1 ? "Post-Meeting" : result.mode === 2 ? "Pre-Meeting Prep" : "Pitch Stress-Test"} Report
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyMarkdown}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
          >
            {copied ? "Copied" : "Copy markdown"}
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
          >
            Download .md
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-10">
        {result.error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {result.error}
          </div>
        )}

        {/* Mode 2 — Pre-Meeting Attack Brief (show first for Pre-Meeting Prep) */}
        {result.mode === 2 && brief && (brief.red_list_framed?.length > 0 || brief.yellow_list_framed?.length > 0) && (
          <section className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">Pre-Meeting Attack Brief</h2>
            <p className="text-sm font-medium text-red-400/90 mb-2">
              They will not have a good answer to this. Probe hard.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-300 text-sm mb-4">
              {(brief.red_list_framed ?? []).map((r) => (
                <li key={r.question.slice(0, 40)}>
                  {escapeHtml(r.question)}
                  <span className="text-zinc-500 block ml-4">{r.source_finding}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-amber-400/90 mb-2">
              This is where you separate polish from preparation.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-300 text-sm mb-4">
              {(brief.yellow_list_framed ?? []).map((y) => (
                <li key={y.question.slice(0, 40)}>
                  {escapeHtml(y.question)}
                  <span className="text-zinc-500 block ml-4">{y.source_finding}</span>
                </li>
              ))}
            </ul>
            {(brief.recommended_sequence ?? []).length > 0 && (
              <>
                <p className="text-sm font-medium text-zinc-400 mb-2">Recommended sequence</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-sm">
                  {brief.recommended_sequence.map((s, i) => (
                    <li key={i}>{escapeHtml(s)}</li>
                  ))}
                </ol>
              </>
            )}
          </section>
        )}

        {/* Evidence Map */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-200 mb-4">Evidence Map</h2>
          {claims.length === 0 ? (
            <p className="text-zinc-500 text-sm">No claims extracted.</p>
          ) : (
            <ul className="space-y-3">
              {claims.map((c) => (
                <li
                  key={c.id}
                  className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {statusBadge(c.status)}
                    <span className="text-xs text-zinc-500 uppercase">{c.category}</span>
                  </div>
                  <p className="font-medium text-zinc-100">{escapeHtml(c.claim)}</p>
                  {c.source_quote && (
                    <p className="mt-2 text-sm text-zinc-400 italic">&ldquo;{escapeHtml(c.source_quote)}&rdquo;</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Conflict Report */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-200 mb-4">Conflict Report</h2>
          {layer2Skipped ? (
            <p className="text-zinc-500 text-sm">Skipped — no private stream provided.</p>
          ) : conflicts.length === 0 ? (
            <p className="text-zinc-500 text-sm">No conflicts.</p>
          ) : (
            <>
              {result.layer_2?.conflict_summary && (
                <p className="text-zinc-400 text-sm mb-4">{result.layer_2.conflict_summary}</p>
              )}
              <ul className="space-y-4">
                {conflicts.map((c) => (
                  <li
                    key={c.id}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/40"
                  >
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Stream 1</p>
                      <p className="text-sm text-zinc-300">{escapeHtml(c.stream_1_quote)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Stream 2</p>
                      <p className="text-sm text-zinc-300">{escapeHtml(c.stream_2_quote)}</p>
                    </div>
                    <div className="md:col-span-2 flex flex-wrap gap-2 items-center pt-2 border-t border-zinc-800">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        Type {c.type}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          c.severity === "high"
                            ? "bg-red-500/20 text-red-400"
                            : c.severity === "medium"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {c.severity}
                      </span>
                      <p className="text-sm text-zinc-400 w-full">{c.strategic_implication}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* GRUE Coverage */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-200 mb-4">GRUE Coverage</h2>
          {grue && (
            <>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-400">Coverage</span>
                  <span className="text-zinc-200">{grue.coverage_score}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500/80 rounded-full transition-all"
                    style={{ width: `${Math.min(100, grue.coverage_score)}%` }}
                  />
                </div>
              </div>
              <ul className="space-y-2">
                {(grue.grue_coverage ?? []).map((m) => (
                  <li
                    key={m.metric}
                    className="flex items-center gap-3 py-2 border-b border-zinc-800/80"
                  >
                    <span
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                        m.status === "mentioned"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : m.status === "underspecified"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {m.status === "mentioned" ? "✓" : m.status === "underspecified" ? "⚠" : "✗"}
                    </span>
                    <span className="text-zinc-300">{m.metric}</span>
                    {m.source_quote && (
                      <span className="text-xs text-zinc-500 truncate flex-1" title={m.source_quote}>
                        &ldquo;{m.source_quote.slice(0, 60)}…&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {(grue.blind_spots ?? []).length > 0 && (
                <p className="mt-3 text-sm text-amber-400/90">
                  Blind spots: {grue.blind_spots.join(", ")}
                </p>
              )}
            </>
          )}
        </section>

        {/* Conviction Interrogation */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-200 mb-4">Conviction Interrogation</h2>

          {red.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-red-400/90 mb-2">Red List</h3>
              <ul className="space-y-3">
                {red.map((r) => (
                  <li
                    key={r.question.slice(0, 40)}
                    className="pl-4 border-l-4 border-red-500/60 py-2"
                  >
                    <p className="font-medium text-zinc-100">{escapeHtml(r.question)}</p>
                    <p className="text-sm text-zinc-500 mt-1">Source: {escapeHtml(r.source_description)}</p>
                    <p className="text-sm text-red-400/80 italic mt-1">{r.why_existential}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yellow.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-amber-400/90 mb-2">Yellow List</h3>
              <ul className="space-y-2">
                {yellow.map((y) => (
                  <li
                    key={y.question.slice(0, 40)}
                    className="pl-4 border-l-4 border-amber-500/50 py-2"
                  >
                    <p className="text-zinc-200">{escapeHtml(y.question)}</p>
                    <p className="text-sm text-zinc-500 mt-1">{escapeHtml(y.source_description)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pedigree.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h3 className="text-sm font-medium text-amber-400/90 mb-2">Pedigree Flags</h3>
              <ul className="space-y-1 text-sm text-zinc-300">
                {pedigree.map((p) => (
                  <li key={p.flag.slice(0, 30)}>
                    [{p.severity}] {escapeHtml(p.flag)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Mode 2 Attack Brief (bottom only when not already shown at top) */}
        {result.mode !== 2 && brief && (brief.red_list_framed?.length > 0 || brief.yellow_list_framed?.length > 0) && (
          <section className="p-4 rounded-xl border border-zinc-700 bg-zinc-900/60">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">Pre-Meeting Attack Brief</h2>
            <p className="text-sm font-medium text-red-400/90 mb-2">
              They will not have a good answer to this. Probe hard.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-300 text-sm mb-4">
              {(brief.red_list_framed ?? []).map((r) => (
                <li key={r.question.slice(0, 40)}>
                  {escapeHtml(r.question)}
                  <span className="text-zinc-500 block ml-4">{r.source_finding}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-amber-400/90 mb-2">
              This is where you separate polish from preparation.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-300 text-sm mb-4">
              {(brief.yellow_list_framed ?? []).map((y) => (
                <li key={y.question.slice(0, 40)}>
                  {escapeHtml(y.question)}
                  <span className="text-zinc-500 block ml-4">{y.source_finding}</span>
                </li>
              ))}
            </ul>
            {(brief.recommended_sequence ?? []).length > 0 && (
              <>
                <p className="text-sm font-medium text-zinc-400 mb-2">Recommended sequence</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-sm">
                  {brief.recommended_sequence.map((s, i) => (
                    <li key={i}>{escapeHtml(s)}</li>
                  ))}
                </ol>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
