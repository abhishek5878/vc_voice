"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { PipelineResult } from "@/lib/pipeline/types";
import type { SessionMetadata } from "@/lib/sessionMetadata";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";
import {
  pipelineResultToMarkdown,
  buildEvidenceFirstMarkdown,
  buildCalendarDescription,
  buildGoogleCalendarEventUrl,
  buildOutlookCalendarEventUrl,
  buildSlackSummary,
  buildFollowUpEmailBody,
  buildReplyToFounderEmailBody,
} from "@/lib/reportMarkdown";

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export default function AnalysisReport({
  result,
  metadata,
  onBack,
  onDuplicateRun,
  dealId,
  onDealSaved,
}: {
  result: PipelineResult;
  metadata?: SessionMetadata | null;
  onBack: () => void;
  onDuplicateRun?: () => void;
  dealId?: string | null;
  onDealSaved?: (dealId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [slackCopied, setSlackCopied] = useState(false);
  const [evidenceExportCopied, setEvidenceExportCopied] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveCompanyName, setSaveCompanyName] = useState(metadata?.companyName ?? "");
  const [sharePublic, setSharePublic] = useState(false);
  const [shareToggleLoading, setShareToggleLoading] = useState(false);

  const copyMarkdown = useCallback(() => {
    const md = pipelineResultToMarkdown(result, metadata);
    void navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, metadata]);

  const downloadMarkdown = useCallback(() => {
    const md = pipelineResultToMarkdown(result, metadata);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `robin-report-mode-${result.mode}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, metadata]);

  const calendarDescription = buildCalendarDescription(result);

  const copyCalendarDescription = useCallback(() => {
    void navigator.clipboard.writeText(calendarDescription).then(() => {
      setCalendarCopied(true);
      setTimeout(() => setCalendarCopied(false), 2000);
    });
  }, [calendarDescription]);

  const openGoogleCalendar = useCallback(() => {
    window.open(buildGoogleCalendarEventUrl(metadata ?? null, calendarDescription), "_blank", "noopener,noreferrer");
  }, [metadata, calendarDescription]);

  const openOutlookCalendar = useCallback(() => {
    window.open(buildOutlookCalendarEventUrl(metadata ?? null, calendarDescription), "_blank", "noopener,noreferrer");
  }, [metadata, calendarDescription]);

  const copySlackSummary = useCallback(() => {
    const text = buildSlackSummary(result, metadata ?? null);
    void navigator.clipboard.writeText(text).then(() => {
      setSlackCopied(true);
      setTimeout(() => setSlackCopied(false), 2000);
    });
  }, [result, metadata]);

  const copyEvidenceFirstExport = useCallback(() => {
    const md = buildEvidenceFirstMarkdown(result, metadata?.companyName ?? undefined);
    void navigator.clipboard.writeText(md).then(() => {
      setEvidenceExportCopied(true);
      setTimeout(() => setEvidenceExportCopied(false), 2000);
    });
  }, [result, metadata?.companyName]);

  const emailBrief = useCallback(() => {
    const md = pipelineResultToMarkdown(result, metadata);
    const subject = encodeURIComponent(
      metadata?.meetingTitle || metadata?.companyName
        ? `Robin brief: ${[metadata.meetingTitle, metadata.companyName].filter(Boolean).join(" — ")}`
        : "PitchRobin brief"
    );
    const body = encodeURIComponent(md.slice(0, 12000));
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }, [result, metadata]);

  const followUpEmail = useCallback(() => {
    const body = buildFollowUpEmailBody(result, metadata ?? null);
    const subject = encodeURIComponent(
      metadata?.meetingTitle || metadata?.companyName
        ? `Follow-up: ${[metadata.meetingTitle, metadata.companyName].filter(Boolean).join(" — ")}`
        : "Follow-up"
    );
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`, "_blank");
  }, [result, metadata]);

  const replyToFounder = useCallback(() => {
    const body = buildReplyToFounderEmailBody(result, metadata ?? null);
    const subject = encodeURIComponent(
      metadata?.meetingTitle || metadata?.companyName
        ? `Re: ${[metadata.meetingTitle, metadata.companyName].filter(Boolean).join(" — ")}`
        : "Re: Your deck"
    );
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`, "_blank");
  }, [result, metadata]);

  const copyBriefAndOpenEvent = useCallback(() => {
    void navigator.clipboard.writeText(calendarDescription).then(() => {
      if (metadata?.calendarEventUrl) window.open(metadata.calendarEventUrl, "_blank", "noopener,noreferrer");
    });
  }, [calendarDescription, metadata?.calendarEventUrl]);

  const generateRiskSnapshot = useCallback(async () => {
    if (!dealId || snapshotLoading) return;
    setSnapshotLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) return;
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-supabase-access-token": token },
        body: JSON.stringify({ share_public: true }),
      });
      window.open(`/snapshot/${dealId}`, "_blank", "noopener,noreferrer");
    } finally {
      setSnapshotLoading(false);
    }
  }, [dealId, snapshotLoading]);

  const handleSaveAndTrack = useCallback(async () => {
    const company = (saveCompanyName || metadata?.companyName || "").trim();
    if (!company) return;
    setSaveLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) {
        return;
      }
      const res = await fetch("/api/deals/save-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": token,
        },
        body: JSON.stringify({ companyName: company, report: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onDealSaved?.(data.dealId);
    } finally {
      setSaveLoading(false);
    }
  }, [result, saveCompanyName, metadata?.companyName, onDealSaved]);

  const handleSharePublicToggle = useCallback(async () => {
    if (!dealId || shareToggleLoading) return;
    setShareToggleLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) return;
      const next = !sharePublic;
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-supabase-access-token": token },
        body: JSON.stringify({ share_public: next }),
      });
      setSharePublic(next);
    } finally {
      setShareToggleLoading(false);
    }
  }, [dealId, sharePublic, shareToggleLoading]);

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
          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
          : "bg-red-500/20 text-red-400 border-red-500/40";
    const label = status === "verified" ? "✓ Verified" : status === "unverified" ? "⚠ Unverified" : "✗ Contradicted";
    return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {!dealId && (
        <div className="bg-cyan-500/15 border-b border-cyan-500/40 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-cyan-200 text-sm font-medium">
            This deal is not yet saved to your Deal Memory.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!metadata?.companyName && (
              <input
                type="text"
                value={saveCompanyName}
                onChange={(e) => setSaveCompanyName(e.target.value)}
                placeholder="Company name"
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm w-40"
              />
            )}
            <button
              type="button"
              onClick={() => void handleSaveAndTrack()}
              disabled={saveLoading || !(saveCompanyName.trim() || metadata?.companyName?.trim())}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-zinc-950 text-sm font-medium"
            >
              {saveLoading ? "Saving…" : "Save & Track This Deal"}
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
            ← Back to input
          </button>
          <h1 className="text-lg font-semibold tracking-tight">
            PitchRobin — {result.mode === 1 ? "Post-Meeting" : result.mode === 2 ? "Pre-Meeting Prep" : "Pitch Stress-Test"} Report
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metadata?.companyName && (
            <Link
              href="/app/deals"
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm border border-zinc-700/50"
            >
              View Deal History
            </Link>
          )}
          {dealId && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={sharePublic}
                  onChange={() => void handleSharePublicToggle()}
                  disabled={shareToggleLoading}
                  className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500/50"
                />
                {shareToggleLoading ? "Updating…" : "Allow public snapshot"}
              </label>
              <button
                type="button"
                onClick={() => void generateRiskSnapshot()}
                disabled={snapshotLoading}
                className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm border border-cyan-500/40 disabled:opacity-50"
              >
                {snapshotLoading ? "Generating…" : "Generate Risk Snapshot"}
              </button>
            </>
          )}
          {onDuplicateRun && (
            <button
              type="button"
              onClick={onDuplicateRun}
              className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm border border-cyan-500/40"
            >
              Duplicate this run
            </button>
          )}
          <button
            type="button"
            onClick={copyCalendarDescription}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="Copy brief text to paste into any calendar"
          >
            {calendarCopied ? "Copied" : "Copy for calendar"}
          </button>
          {metadata?.calendarEventUrl && (
            <button
              type="button"
              onClick={copyBriefAndOpenEvent}
              className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm border border-cyan-500/40"
              title="Copy brief and open your calendar event to paste"
            >
              Copy & open event
            </button>
          )}
          <button
            type="button"
            onClick={openGoogleCalendar}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="Open Google Calendar with event prefilled"
          >
            Google Calendar
          </button>
          <button
            type="button"
            onClick={openOutlookCalendar}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="Open Outlook calendar with event prefilled"
          >
            Outlook
          </button>
          <button
            type="button"
            onClick={copySlackSummary}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="Copy short summary for Slack or chat"
          >
            {slackCopied ? "Copied" : "Copy for Slack"}
          </button>
          <button
            type="button"
            onClick={copyEvidenceFirstExport}
            className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm border border-cyan-500/40 transition-colors"
            title="Evidence-first brief: 3 high-stakes questions + evidence gaps (Slack/Notion)"
          >
            {evidenceExportCopied ? "Copied" : "Export to Slack/Notion"}
          </button>
          <button
            type="button"
            onClick={emailBrief}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
          >
            Email brief
          </button>
          <button
            type="button"
            onClick={followUpEmail}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="One-click follow-up: Robin flagged [topics]. Can you share data on X?"
          >
            Follow-up email
          </button>
          <button
            type="button"
            onClick={replyToFounder}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
            title="Draft reply to founder: clarify first red question + one GRUE blind spot"
          >
            Reply to founder
          </button>
          <button
            type="button"
            onClick={copyMarkdown}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
          >
            {copied ? "Copied" : "Copy markdown"}
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors border border-zinc-700/50"
          >
            Download .md
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-10">
        {(metadata?.meetingTitle || metadata?.companyName) && (
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            {metadata.meetingTitle && <span>Meeting: {escapeHtml(metadata.meetingTitle)}</span>}
            {metadata.companyName && <span>Company: {escapeHtml(metadata.companyName)}</span>}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Copy the brief into your calendar event, email a co-investor, or run again with different input (your last run is saved).
        </p>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Use with your tools</h3>
          <ul className="text-xs text-zinc-500 space-y-1">
            <li><strong className="text-zinc-400">Calendar:</strong> Use the buttons above to open Google Calendar or Outlook with the brief prefilled, or copy and paste into any event.</li>
            <li><strong className="text-zinc-400">Email:</strong> Email brief sends a mailto with the full report. Add your co-investor&apos;s address before sending.</li>
            <li><strong className="text-zinc-400">Slack / Notion:</strong> Copy for Slack (short summary), Export to Slack/Notion (evidence-first brief), or Copy markdown (full report). Paste into a channel or a doc.</li>
            <li><strong className="text-zinc-400">Bookmarks:</strong> <span className="font-mono text-zinc-400">/app?mode=1</span> for post-call, <span className="font-mono text-zinc-400">/app?mode=2</span> for prep, <span className="font-mono text-zinc-400">/app?mode=3</span> for founder stress-test.</li>
          </ul>
        </section>

        {result.error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {result.error}
          </div>
        )}

        {/* Mode 2 — Pre-Meeting Attack Brief (show first for Pre-Meeting Prep) */}
        {result.mode === 2 && brief && (brief.red_list_framed?.length > 0 || brief.yellow_list_framed?.length > 0) && (
          <section className="p-5 sm:p-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/5">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">Pre-Meeting Attack Brief</h2>
            <p className="text-sm font-medium text-red-400/90 mb-2">
              They will not have a good answer to this. Probe hard.
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 text-sm mb-4">
              {(brief.red_list_framed ?? []).map((r) => (
                <li key={r.question.slice(0, 40)}>
                  {escapeHtml(r.question)}
                  {r.source_finding && (
                    <span className="text-red-400/90 font-medium block mt-0.5">Why red: <span className="text-zinc-500 font-normal">{escapeHtml(r.source_finding)}</span></span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-cyan-400/90 mb-2">
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
        <section className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-xl font-semibold text-zinc-200 mb-4">Evidence Map</h2>
          {claims.length === 0 ? (
            <p className="text-zinc-500 text-sm">No claims extracted.</p>
          ) : (
            <ul className="space-y-3">
              {claims.map((c) => (
                <li
                  key={c.id}
                  className={`p-4 rounded-xl border bg-zinc-950/60 ${
                    c.status === "unverified"
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : c.status === "contradicted"
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-zinc-800"
                  }`}
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
        <section className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
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
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950/60"
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
                              ? "bg-cyan-500/20 text-cyan-400"
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
        <section className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
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
                    className="h-full bg-cyan-500/80 rounded-full transition-all"
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
                            ? "bg-cyan-500/20 text-cyan-400"
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
                <p className="mt-3 text-sm text-cyan-400/90">
                  Blind spots: {grue.blind_spots.join(", ")}
                </p>
              )}
            </>
          )}
        </section>

        {/* Conviction Interrogation */}
        <section className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
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
                    {r.why_existential && (
                      <p className="text-sm text-red-400/90 mt-1.5 font-medium">
                        Why red: <span className="italic font-normal">{escapeHtml(r.why_existential)}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yellow.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-cyan-400/90 mb-2">Yellow List</h3>
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
              <h3 className="text-sm font-medium text-cyan-400/90 mb-2">Pedigree Flags</h3>
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
          <section className="p-5 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-xl font-semibold text-zinc-200 mb-4">Pre-Meeting Attack Brief</h2>
            <p className="text-sm font-medium text-red-400/90 mb-2">
              They will not have a good answer to this. Probe hard.
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 text-sm mb-4">
              {(brief.red_list_framed ?? []).map((r) => (
                <li key={r.question.slice(0, 40)}>
                  {escapeHtml(r.question)}
                  {r.source_finding && (
                    <span className="text-red-400/90 font-medium block mt-0.5">Why red: <span className="text-zinc-500 font-normal">{escapeHtml(r.source_finding)}</span></span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-cyan-400/90 mb-2">
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
