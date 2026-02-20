"use client";

import { useState, useCallback } from "react";
import type { DebriefAnalysis, PreMeetingContext } from "@/lib/debrief/types";

export default function DebriefForm({
  dealId,
  slug,
  investorDisplayName,
  companyName,
}: {
  dealId: string;
  slug: string;
  investorDisplayName: string;
  companyName: string;
}) {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DebriefAnalysis | null>(null);
  const [preMeeting, setPreMeeting] = useState<PreMeetingContext | null>(null);

  const handleAnalyze = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      setError("Paste your transcript first.");
      return;
    }
    setError(null);
    setAnalysis(null);
    setPreMeeting(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pitch/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, slug, transcript: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error || data.detail || "Request failed") as string);
        return;
      }
      if (data.analysis) {
        setAnalysis(data.analysis as DebriefAnalysis);
        if (data.pre_meeting) setPreMeeting(data.pre_meeting as PreMeetingContext);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [dealId, slug, transcript]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Paste your call transcript below (from Granola, Otter, Fireflies, or manual notes). We’ll analyze what landed
        and how it compares to your prep.
      </p>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste transcript here..."
        rows={12}
        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 resize-y min-h-[200px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-900 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Analyze pitch"}
        </button>
        {error && <p className="text-sm text-amber-400">{error}</p>}
      </div>

      {analysis && (
        <DebriefResult
          analysis={analysis}
          preMeeting={preMeeting}
          investorDisplayName={investorDisplayName}
          companyName={companyName}
        />
      )}
    </div>
  );
}

function DebriefResult({
  analysis,
  preMeeting,
  investorDisplayName,
  companyName,
}: {
  analysis: DebriefAnalysis;
  preMeeting: PreMeetingContext | null;
  investorDisplayName: string;
  companyName: string;
}) {
  const { headline, scores, score_reasons, narrative, key_moments } = analysis;
  return (
    <div className="space-y-6 pt-4 border-t border-zinc-700">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90 mb-1">
          Verdict {companyName && `· ${companyName}`}
        </p>
        <p className="text-lg font-medium text-zinc-100">{headline}</p>
      </div>

      {preMeeting && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">PRE / POST</p>
          <p className="text-sm text-zinc-300">
            <span className="text-zinc-500">Robin predicted: </span>
            Clarity {preMeeting.clarity_score != null ? `${Math.round(preMeeting.clarity_score)}/100` : "—"} · Risk{" "}
            {preMeeting.risk_label} · Resistance {preMeeting.resistance_label}.
          </p>
          <p className="text-sm text-zinc-300">
            <span className="text-zinc-500">What actually happened: </span>
            See scores and narrative below — compare where {investorDisplayName} pushed back vs what you nailed.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90 mb-3">Scores</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: "overall", label: "Overall", value: scores.overall, reason: score_reasons.overall },
            { key: "clarity", label: "Clarity", value: scores.clarity, reason: score_reasons.clarity },
            { key: "vision", label: "Vision", value: scores.vision, reason: score_reasons.vision },
            { key: "unfair_edge", label: "Unfair edge", value: scores.unfair_edge, reason: score_reasons.unfair_edge },
          ].map(({ label, value, reason }) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
              <p className="text-lg font-semibold text-zinc-100">{value}/100</p>
              <p className="text-xs text-zinc-400 mt-0.5">{reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90 mb-2">What resonated</p>
          <ul className="text-sm text-zinc-300 list-disc list-inside space-y-1">
            {(narrative.resonated ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-2">Where you lost them</p>
          <ul className="text-sm text-zinc-300 list-disc list-inside space-y-1">
            {(narrative.lost_them ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90">Key moments</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-emerald-400/90">NAILED IT</p>
            {(key_moments.nailed ?? []).map((m, i) => (
              <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
                <p className="text-sm text-zinc-200 italic">&ldquo;{m.quote}&rdquo;</p>
                <p className="text-xs text-zinc-400 mt-1">{m.summary}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-400/90">NEEDS WORK</p>
            {(key_moments.needs_work ?? []).map((m, i) => (
              <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
                <p className="text-sm text-zinc-200 italic">&ldquo;{m.quote}&rdquo;</p>
                <p className="text-xs text-zinc-400 mt-1">{m.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(analysis.recommended_vcs ?? []).length > 0 && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90 mb-3">Investors to reach out to next</p>
          <p className="text-sm text-zinc-400 mb-3">Based on this pitch, these VCs may be a good fit for your next conversations.</p>
          <ul className="space-y-3">
            {analysis.recommended_vcs!.map((vc, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700">
                <div>
                  <p className="font-medium text-zinc-100">{vc.display_name}</p>
                  {vc.fund && <p className="text-xs text-zinc-500">{vc.fund}</p>}
                  <p className="text-sm text-zinc-400 mt-1">{vc.reason}</p>
                  <p className="text-xs text-cyan-400 mt-1">Fit: {vc.fit_pct}%</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/pitch/${vc.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Pitch page
                  </a>
                  {vc.linkedin_url && (
                    <a href={vc.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300">
                      LinkedIn
                    </a>
                  )}
                  {vc.twitter_url && (
                    <a href={vc.twitter_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300">
                      X
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
