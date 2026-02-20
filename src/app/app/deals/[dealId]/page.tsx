"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";
import type { Deal, DealRun, FounderClaimRow } from "@/lib/deals/types";
import type { PipelineResult } from "@/lib/pipeline/types";
import { buildEvidenceFirstMarkdown } from "@/lib/reportMarkdown";

interface DealDetail {
  deal: Deal;
  runs: DealRun[];
  claimDrift: FounderClaimRow[];
  clarityPercentile: number | null;
  strengthPercentile: number | null;
  totalDeals: number;
}

function riskLevel(score: number | null): string {
  if (score == null) return "—";
  const v = score;
  if (v <= 25) return "Low";
  if (v <= 50) return "Medium";
  if (v <= 75) return "High";
  return "Fragile";
}
function clarityLevel(score: number | null): string {
  if (score == null) return "—";
  const v = score;
  if (v > 75) return "Crisp";
  if (v >= 50) return "Promising";
  return "Narrative";
}
function resistanceLevel(score: number | null): string {
  if (score == null) return "—";
  const v = score;
  if (v > 75) return "Strong";
  if (v >= 50) return "Mixed";
  return "Weak";
}

export default function DealDetailPage() {
  const params = useParams();
  const dealId = params?.dealId as string;
  const [data, setData] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [sharePublic, setSharePublic] = useState(false);
  const [shareToggleLoading, setShareToggleLoading] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    (async () => {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setError("Sign in to view this deal.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/deals/${dealId}`, {
          headers: { "x-supabase-access-token": token },
        });
        if (!res.ok) {
          if (res.status === 404) {
            setError("Deal not found.");
            return;
          }
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setOutcome(json.deal?.outcome ?? "");
          setSharePublic(Boolean(json.deal?.share_public));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const handleSharePublicToggle = async () => {
    const token = await getSupabaseAccessToken();
    if (!token || !dealId || !data) return;
    setShareToggleLoading(true);
    const next = !sharePublic;
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-supabase-access-token": token },
        body: JSON.stringify({ share_public: next }),
      });
      setSharePublic(next);
      setData({ ...data, deal: { ...data.deal, share_public: next } });
    } finally {
      setShareToggleLoading(false);
    }
  };

  const handleOutcomeChange = async (value: string) => {
    setOutcome(value);
    const token = await getSupabaseAccessToken();
    if (!token || !dealId) return;
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": token,
        },
        body: JSON.stringify({ outcome: value || null }),
      });
      if (data) {
        const outcomeVal = (value || null) as Deal["outcome"];
        setData({ ...data, deal: { ...data.deal, outcome: outcomeVal } });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 p-6 text-zinc-500 text-sm">Loading…</div>;
  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <p className="text-red-400">{error ?? "Not found"}</p>
        <Link href="/app/deals" className="text-cyan-400 text-sm mt-2 inline-block">← Back to deals</Link>
      </div>
    );
  }

  const { deal, runs, claimDrift, clarityPercentile, strengthPercentile, totalDeals } = data;
  const latestRun = runs[0];
  const riskVal = latestRun?.risk_score ?? null;
  const clarityVal = latestRun?.clarity_score ?? null;
  const resistanceVal = latestRun?.resistance_score ?? null;
  const groupedByClaim = new Map<string, FounderClaimRow[]>();
  claimDrift.forEach((c) => {
    const key = c.claim_text.slice(0, 60);
    if (!groupedByClaim.has(key)) groupedByClaim.set(key, []);
    groupedByClaim.get(key)!.push(c);
  });
  const driftPairs: { original: string; latest: string; status: string }[] = [];
  groupedByClaim.forEach((rows) => {
    if (rows.length < 2) return;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    driftPairs.push({
      original: sorted[0].claim_text,
      latest: sorted[sorted.length - 1].claim_text,
      status: sorted[sorted.length - 1].status,
    });
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app/deals" className="text-zinc-400 hover:text-zinc-200 text-sm">← Deals</Link>
            <h1 className="text-lg font-semibold tracking-tight">{deal.company_name && deal.company_name !== "Unknown" ? deal.company_name : "Unnamed company"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Mark outcome</label>
            <select
              value={outcome}
              onChange={(e) => handleOutcomeChange(e.target.value)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm"
            >
              <option value="">—</option>
              <option value="invested">Invested</option>
              <option value="declined">Declined</option>
              <option value="failed">Failed</option>
              <option value="3x">3x</option>
              <option value="10x">10x</option>
              <option value="zombie">Zombie</option>
            </select>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8">
        {(strengthPercentile != null && totalDeals > 0) && (
          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-sm font-medium text-zinc-400 mb-1">Ranking</h2>
            <p className="text-zinc-200">
              This deal ranks in the top <span className="text-cyan-400 font-medium">{100 - strengthPercentile}%</span> of your {totalDeals} deals by strength.
            </p>
            {clarityPercentile != null && (
              <p className="text-zinc-400 text-sm mt-1">
                By clarity: top {100 - clarityPercentile}%.
              </p>
            )}
          </section>
        )}

        {latestRun && (
          <section className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">Latest run scores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase">Risk level</p>
                <p className={`font-medium ${riskVal != null && riskVal > 50 ? "text-cyan-400" : "text-zinc-200"}`}>{riskLevel(riskVal != null ? riskVal : null)}</p>
                {riskVal != null && <p className="text-zinc-500 text-xs">{riskVal.toFixed(0)}</p>}
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase">Clarity level</p>
                <p className={`font-medium ${clarityVal != null && clarityVal > 75 ? "text-cyan-400" : "text-zinc-200"}`}>{clarityLevel(clarityVal != null ? clarityVal : null)}</p>
                {clarityVal != null && <p className="text-zinc-500 text-xs">{clarityVal.toFixed(0)}</p>}
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase">Resistance level</p>
                <p className={`font-medium ${resistanceVal != null && resistanceVal > 75 ? "text-cyan-400" : "text-zinc-200"}`}>{resistanceLevel(resistanceVal != null ? resistanceVal : null)}</p>
                {resistanceVal != null && <p className="text-zinc-500 text-xs">{resistanceVal.toFixed(0)}</p>}
              </div>
            </div>
          </section>
        )}

        {latestRun?.report_json
          ? (() => {
              const report = latestRun.report_json as PipelineResult;
              const brief = report?.pre_meeting_attack_brief;
              const highStakesQuestions =
                brief?.red_list_framed?.slice(0, 3).map((r) => r?.question) ??
                report?.layer_4?.red_list?.slice(0, 3).map((r) => r?.question) ??
                [];
              const claims = report?.layer_1?.claims ?? [];
              const evidenceGaps = claims.filter((c) => c?.status === "unverified");
              const handleExport = () => {
                const md = buildEvidenceFirstMarkdown(report, deal.company_name);
                void navigator.clipboard.writeText(md).then(() => {
                  setExportCopied(true);
                  setTimeout(() => setExportCopied(false), 2000);
                });
              };
              return (
                <>
                  <section className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                    <h2 className="text-sm font-medium text-zinc-400 mb-3">TL;DR — 3 High-Stakes Questions for Meeting 2</h2>
                    {highStakesQuestions.length ? (
                      <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-200">
                        {highStakesQuestions.map((q, i) => (
                          <li key={i}>{q?.replace(/\n/g, " ") ?? ""}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-zinc-500 text-sm">No red-list questions in this run.</p>
                    )}
                  </section>
                  <section className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <h2 className="text-sm font-medium text-zinc-400 mb-3">Evidence Gap Report</h2>
                    <p className="text-xs text-zinc-500 mb-2">Claims made by the founder not backed by deck or transcript.</p>
                    {evidenceGaps.length ? (
                      <ul className="space-y-2 text-sm">
                        {evidenceGaps.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-400/90 shrink-0">☐</span>
                            <span className="text-zinc-200">{c?.claim}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 text-sm">No unverified claims.</p>
                    )}
                  </section>
                  <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <h2 className="text-sm font-medium text-zinc-400 mb-3">Export</h2>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-900 text-sm font-medium"
                    >
                      {exportCopied ? "Copied" : "Export to Slack / Notion"}
                    </button>
                    <p className="text-xs text-zinc-500 mt-2">Copies an evidence-first markdown brief (high-stakes questions + evidence gaps) to paste into Slack or a Notion doc.</p>
                  </section>
                </>
              );
            })()
          : null}

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Timeline</h2>
          <ul className="space-y-3">
            {runs.map((r) => (
              <li key={r.id} className="flex items-start gap-3 text-sm">
                <span className="text-zinc-500 shrink-0">
                  {new Date(r.created_at).toLocaleString()}
                </span>
                <span className="text-zinc-500">{r.mode === 1 ? "Post-meeting" : r.mode === 2 ? "Pre-meeting" : "Founder stress-test"}</span>
                <span className="text-zinc-400">
                  {(r.red_flags as unknown[]).length} red · {(r.yellow_flags as unknown[]).length} yellow
                </span>
                {r.risk_score != null && (
                  <span className="text-cyan-400/90">risk {Math.round(r.risk_score)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {driftPairs.length > 0 && (
          <section className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <h2 className="text-sm font-medium text-cyan-400/90 mb-3">Claim Drift</h2>
            <ul className="space-y-4">
              {driftPairs.map((p, i) => (
                <li key={i} className="text-sm">
                  <p className="text-zinc-500 text-xs mb-1">Original</p>
                  <p className="text-zinc-400 mb-2">{p.original.slice(0, 200)}{p.original.length > 200 ? "…" : ""}</p>
                  <p className="text-zinc-500 text-xs mb-1">Latest</p>
                  <p className="text-zinc-300">{p.latest.slice(0, 200)}{p.latest.length > 200 ? "…" : ""}</p>
                  <span className="text-cyan-400/90 text-xs">{p.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Red flag evolution</h2>
          {runs.slice(0, 5).map((r, i) => {
            const reds = (r.red_flags as { question: string }[]) ?? [];
            return (
              <div key={r.id} className="mb-4">
                <p className="text-xs text-zinc-500 mb-1">
                  Run {runs.length - i} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  {reds.slice(0, 5).map((f, j) => (
                    <li key={j} className="leading-relaxed">{f.question ?? ""}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={sharePublic}
              onChange={() => void handleSharePublicToggle()}
              disabled={shareToggleLoading}
              className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
            />
            {shareToggleLoading ? "Updating…" : "Allow public snapshot"}
          </label>
          {sharePublic && (
            <Link
              href={`/snapshot/${deal.id}`}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
            >
              View public snapshot
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
