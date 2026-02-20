import type { PipelineResult } from "@/lib/pipeline/types";

/** Escape user content so it doesn't break markdown (e.g. ** or #). */
function esc(s: unknown): string {
  return String(s ?? "").replace(/\*/g, "\\*").replace(/\n/g, " ");
}

/** Build plain text for calendar event description (red-list questions, etc.). */
export function buildCalendarDescription(result: PipelineResult): string {
  const lines: string[] = ["PitchRobin — Prep / Review", ""];
  const brief = result?.pre_meeting_attack_brief;
  if (result?.mode === 2 && brief?.red_list_framed?.length) {
    lines.push("RED LIST (probe hard):");
    brief.red_list_framed.forEach((r, i) => {
      lines.push(`${i + 1}. ${String(r?.question ?? "").replace(/\n/g, " ")}`);
    });
    lines.push("");
  }
  if (result?.mode === 2 && brief?.yellow_list_framed?.length) {
    lines.push("YELLOW LIST:");
    brief.yellow_list_framed.forEach((y, i) => {
      lines.push(`${i + 1}. ${String(y?.question ?? "").replace(/\n/g, " ")}`);
    });
    lines.push("");
  }
  if (result?.mode === 1 && result?.layer_4?.red_list?.length) {
    lines.push("Follow-up (red list):");
    result.layer_4.red_list.forEach((r, i) => {
      lines.push(`${i + 1}. ${String(r?.question ?? "").replace(/\n/g, " ")}`);
    });
  }
  return lines.join("\n").trim() || "PitchRobin report — see app for full brief.";
}

export type CalendarMetadata = { meetingTitle?: string; companyName?: string };

/** Google Calendar: create event with title and description. */
export function buildGoogleCalendarEventUrl(
  meta: CalendarMetadata | null | undefined,
  description: string
): string {
  const title = [meta?.meetingTitle, meta?.companyName].filter(Boolean).join(" — ") || "PitchRobin prep";
  const base = "https://calendar.google.com/calendar/render";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title.slice(0, 200),
    details: description.slice(0, 5000),
  });
  return `${base}?${params.toString()}`;
}

/** Outlook (web): compose calendar event with subject and body. */
export function buildOutlookCalendarEventUrl(
  meta: CalendarMetadata | null | undefined,
  description: string
): string {
  const subject = [meta?.meetingTitle, meta?.companyName].filter(Boolean).join(" — ") || "PitchRobin prep";
  const base = "https://outlook.office.com/calendar/0/action/compose";
  const params = new URLSearchParams({
    subject: subject.slice(0, 200),
    body: description.slice(0, 4000),
  });
  return `${base}?${params.toString()}`;
}

/** Short summary for Slack / chat: meeting, company, and 3–5 bullets from the brief. */
export function buildSlackSummary(
  result: PipelineResult,
  meta: CalendarMetadata | null | undefined
): string {
  const parts: string[] = [];
  if (meta?.meetingTitle || meta?.companyName) {
    parts.push([meta.meetingTitle, meta.companyName].filter(Boolean).join(" — "));
  }
  parts.push(`Robin ${result.mode === 1 ? "Post-meeting" : result.mode === 2 ? "Pre-meeting brief" : "Stress-test"}`);
  const brief = result?.pre_meeting_attack_brief;
  if (brief?.red_list_framed?.length) {
    brief.red_list_framed.slice(0, 3).forEach((r) => {
      parts.push(`• ${String(r?.question ?? "").replace(/\n/g, " ").slice(0, 120)}`);
    });
  } else if (result?.layer_4?.red_list?.length) {
    result.layer_4.red_list.slice(0, 3).forEach((r) => {
      parts.push(`• ${String(r?.question ?? "").replace(/\n/g, " ").slice(0, 120)}`);
    });
  }
  return parts.join("\n");
}

/** One-click follow-up email: "Great chatting. Robin flagged [A], [B]. Can you share data on X?" */
export function buildFollowUpEmailBody(
  result: PipelineResult,
  meta: CalendarMetadata | null | undefined
): string {
  const topics: string[] = [];
  const brief = result?.pre_meeting_attack_brief;
  if (brief?.red_list_framed?.length) {
    brief.red_list_framed.slice(0, 2).forEach((r) => {
      const q = String(r?.question ?? "").replace(/\n/g, " ").slice(0, 80);
      if (q) topics.push(q);
    });
  } else if (result?.layer_4?.red_list?.length) {
    result.layer_4.red_list.slice(0, 2).forEach((r) => {
      const q = String(r?.question ?? "").replace(/\n/g, " ").slice(0, 80);
      if (q) topics.push(q);
    });
  }
  const grue = result?.layer_3;
  if (grue?.blind_spots?.length && topics.length < 2) {
    grue.blind_spots.slice(0, 2 - topics.length).forEach((b) => topics.push(b));
  }
  const firstAsk = brief?.red_list_framed?.[0]?.question
    ?? result?.layer_4?.red_list?.[0]?.question
    ?? "the points above";
  const topicList = topics.length ? topics.join(" and ") : "a few areas";
  const intro =
    meta?.meetingTitle || meta?.companyName
      ? `Following up on ${[meta.meetingTitle, meta.companyName].filter(Boolean).join(" — ")}.\n\n`
      : "";
  return (
    intro +
    `Great chatting. Robin flagged ${topicList} as areas for us to dig deeper. ` +
    `Can you share data on ${firstAsk.slice(0, 60)}${firstAsk.length > 60 ? "…" : ""}?`
  );
}

/** Reply-to-founder email: "Thanks for the deck. Before we meet, can you clarify [first red] and share [one GRUE blind spot]?" */
export function buildReplyToFounderEmailBody(
  result: PipelineResult,
  meta: CalendarMetadata | null | undefined
): string {
  const firstRed =
    result?.pre_meeting_attack_brief?.red_list_framed?.[0]?.question ??
    result?.layer_4?.red_list?.[0]?.question;
  const blindSpot = result?.layer_3?.blind_spots?.[0];
  const intro =
    meta?.meetingTitle || meta?.companyName
      ? `Re: ${[meta.meetingTitle, meta.companyName].filter(Boolean).join(" — ")}\n\n`
      : "";
  let body =
    intro +
    "Thanks for sharing the deck. Before we meet, I’d like to dig a bit deeper.\n\n";
  if (firstRed) {
    body += `Can you clarify: ${firstRed.replace(/\n/g, " ").slice(0, 120)}${firstRed.length > 120 ? "…" : ""}?\n\n`;
  }
  if (blindSpot) {
    body += `Also, could you share data or context on: ${blindSpot}?\n\n`;
  }
  body += "Looking forward to the conversation.";
  return body;
}

/** Red list bullets for Recent Run preview / copy. */
export function getRedListPreview(result: PipelineResult): string[] {
  const brief = result?.pre_meeting_attack_brief;
  if (brief?.red_list_framed?.length) {
    return brief.red_list_framed.map((r) => String(r?.question ?? "").replace(/\n/g, " "));
  }
  if (result?.layer_4?.red_list?.length) {
    return result.layer_4.red_list.map((r) => String(r?.question ?? "").replace(/\n/g, " "));
  }
  return [];
}

export function pipelineResultToMarkdown(
  result: PipelineResult,
  metadata?: { meetingTitle?: string; companyName?: string; calendarEventUrl?: string } | null
): string {
  const lines: string[] = ["# PitchRobin Analysis Report", "", `Mode: ${result?.mode ?? 1}`, ""];
  if (metadata?.meetingTitle || metadata?.companyName) {
    if (metadata.meetingTitle) lines.push(`Meeting: ${String(metadata.meetingTitle).replace(/\n/g, " ")}`, "");
    if (metadata.companyName) lines.push(`Company: ${String(metadata.companyName).replace(/\n/g, " ")}`, "");
  }

  // Layer 1 — Evidence Map
  lines.push("## Evidence Map", "");
  const claims = result?.layer_1?.claims ?? [];
  if (claims.length === 0) {
    lines.push("No claims extracted.", "");
  } else {
    claims.forEach((c) => {
      lines.push(`- **${esc(c?.claim)}**`);
      lines.push(`  - Status: ${c?.status ?? ""} | Category: ${c?.category ?? ""}`);
      if (c?.source_quote) lines.push(`  - Source: "${esc(c.source_quote)}"`);
      lines.push("");
    });
  }

  // Layer 2 — Conflict Report
  const conflicts = result?.layer_2?.conflicts ?? [];
  if (result?.layer_2?.skipped) {
    lines.push("## Conflict Report", "", "*Skipped (no private stream).*", "");
  } else if (conflicts.length > 0) {
    lines.push("## Conflict Report", "");
    if (result?.layer_2?.conflict_summary) {
      lines.push(esc(result.layer_2.conflict_summary), "");
    }
    conflicts.forEach((c) => {
      lines.push(`### ${c?.type ?? ""} — ${c?.severity ?? ""}`, "");
      lines.push("- **Stream 1:** " + esc(c?.stream_1_quote));
      lines.push("- **Stream 2:** " + esc(c?.stream_2_quote));
      lines.push("- **Implication:** " + esc(c?.strategic_implication), "");
    });
  }

  // Layer 3 — GRUE
  lines.push("## GRUE Coverage", "");
  const grue = result?.layer_3;
  if (grue) {
    lines.push(`Coverage score: ${grue.coverage_score}%`, "");
    const mentioned = (grue.grue_coverage ?? []).filter((m) => m.status === "mentioned");
    const underspecified = (grue.grue_coverage ?? []).filter((m) => m.status === "underspecified");
    const missing = (grue.grue_coverage ?? []).filter((m) => m.status === "missing");
    if (mentioned.length) {
      lines.push("### Mentioned", "");
      mentioned.forEach((m) => lines.push(`- ${esc(m?.metric)}: "${esc((m?.source_quote ?? "").slice(0, 80))}…"`));
      lines.push("");
    }
    if (underspecified.length) {
      lines.push("### Underspecified", "");
      underspecified.forEach((m) => lines.push(`- ${esc(m?.metric)}`));
      lines.push("");
    }
    if (missing.length) {
      lines.push("### Missing", "");
      missing.forEach((m) => lines.push(`- ${esc(m?.metric)}`));
      lines.push("");
    }
    if ((grue.blind_spots ?? []).length) {
      lines.push("**Blind spots:** " + grue.blind_spots.join(", "), "");
    }
  }

  // Layer 4 — Interrogation
  lines.push("## Conviction Interrogation", "");
  const red = result?.layer_4?.red_list ?? [];
  const yellow = result?.layer_4?.yellow_list ?? [];
  const pedigree = result?.layer_4?.pedigree_flags ?? [];

  if (red.length) {
    lines.push("### Red List", "");
    red.forEach((r) => {
      lines.push(`1. ${esc(r?.question)}`);
      lines.push(`   - *Why existential:* ${esc(r?.why_existential)}`);
      lines.push(`   - Source: ${esc(r?.source_description)}`);
      lines.push("");
    });
  }
  if (yellow.length) {
    lines.push("### Yellow List", "");
    yellow.forEach((y) => {
      lines.push(`- ${esc(y?.question)}`);
      lines.push(`  - ${esc(y?.source_description)}`);
      lines.push("");
    });
  }
  if (pedigree.length) {
    lines.push("### Pedigree Flags", "");
    pedigree.forEach((p) => lines.push(`- [${p?.severity ?? ""}] ${esc(p?.flag)}`));
    lines.push("");
  }

  // Mode 2 — Attack Brief
  const brief = result?.pre_meeting_attack_brief;
  if (brief) {
    lines.push("## Pre-Meeting Attack Brief", "");
    lines.push("**They will not have a good answer to this. Probe hard.**", "");
    (brief.red_list_framed ?? []).forEach((r) => {
      lines.push(`- ${esc(r?.question)}`);
      lines.push(`  *${esc(r?.source_finding)}*`);
      lines.push("");
    });
    lines.push("**This is where you separate polish from preparation.**", "");
    (brief.yellow_list_framed ?? []).forEach((y) => {
      lines.push(`- ${esc(y?.question)}`);
      lines.push(`  *${esc(y?.source_finding)}*`);
      lines.push("");
    });
    if ((brief.recommended_sequence ?? []).length) {
      lines.push("**Recommended sequence:**", "");
      brief.recommended_sequence.forEach((s, i) => lines.push(`${i + 1}. ${esc(s)}`));
    }
  }

  return lines.join("\n");
}

/** Evidence-first markdown for Slack/Notion: high-stakes questions first, then evidence gaps, then brief summary. */
export function buildEvidenceFirstMarkdown(
  result: PipelineResult,
  companyName?: string | null
): string {
  const lines: string[] = ["# Evidence-first brief", ""];
  if (companyName) {
    lines.push(`**Company:** ${esc(companyName)}`, "");
  }

  // 1) 3 High-Stakes Questions for Meeting 2
  lines.push("## 3 High-Stakes Questions for Meeting 2", "");
  const brief = result?.pre_meeting_attack_brief;
  const redQuestions =
    brief?.red_list_framed?.slice(0, 3).map((r) => r?.question) ??
    result?.layer_4?.red_list?.slice(0, 3).map((r) => r?.question) ??
    [];
  if (redQuestions.length) {
    redQuestions.forEach((q, i) => {
      lines.push(`${i + 1}. ${esc(q)}`);
    });
    lines.push("");
  } else {
    lines.push("(No red-list questions from this run.)", "");
  }

  // 2) Evidence Gap Report — claims not backed by deck/transcript
  lines.push("## Evidence Gap Report", "");
  lines.push("Claims made by the founder that were **not** backed by the uploaded deck or transcript:", "");
  const claims = result?.layer_1?.claims ?? [];
  const unverified = claims.filter((c) => c?.status === "unverified");
  if (unverified.length) {
    unverified.forEach((c) => {
      lines.push(`- [ ] ${esc(c?.claim)}`);
      if (c?.source_quote) lines.push(`  - *Quote:* \"${esc(c.source_quote)}\"`);
    });
    lines.push("");
  } else {
    lines.push("(No unverified claims.)", "");
  }

  // 3) One-line summary
  const red = result?.layer_4?.red_list ?? [];
  const yellow = result?.layer_4?.yellow_list ?? [];
  lines.push("## Summary", "");
  lines.push(
    `${red.length} red, ${yellow.length} yellow. ${unverified.length} evidence gap(s). Use the questions above to probe in Meeting 2.`,
    ""
  );
  return lines.join("\n");
}
