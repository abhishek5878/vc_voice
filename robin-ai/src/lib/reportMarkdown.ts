import type { PipelineResult } from "@/lib/pipeline/types";

export function pipelineResultToMarkdown(result: PipelineResult): string {
  const lines: string[] = ["# Robin.ai Analysis Report", "", `Mode: ${result.mode}`, ""];

  // Layer 1 — Evidence Map
  lines.push("## Evidence Map", "");
  const claims = result.layer_1?.claims ?? [];
  if (claims.length === 0) {
    lines.push("No claims extracted.", "");
  } else {
    claims.forEach((c) => {
      lines.push(`- **${c.claim}**`);
      lines.push(`  - Status: ${c.status} | Category: ${c.category}`);
      if (c.source_quote) lines.push(`  - Source: "${c.source_quote}"`);
      lines.push("");
    });
  }

  // Layer 2 — Conflict Report
  const conflicts = result.layer_2?.conflicts ?? [];
  if (result.layer_2?.skipped) {
    lines.push("## Conflict Report", "", "*Skipped (no private stream).*", "");
  } else if (conflicts.length > 0) {
    lines.push("## Conflict Report", "");
    if (result.layer_2?.conflict_summary) {
      lines.push(result.layer_2.conflict_summary, "");
    }
    conflicts.forEach((c) => {
      lines.push(`### ${c.type} — ${c.severity}`, "");
      lines.push("- **Stream 1:** " + (c.stream_1_quote || "").replace(/\n/g, " "));
      lines.push("- **Stream 2:** " + (c.stream_2_quote || "").replace(/\n/g, " "));
      lines.push("- **Implication:** " + c.strategic_implication, "");
    });
  }

  // Layer 3 — GRUE
  lines.push("## GRUE Coverage", "");
  const grue = result.layer_3;
  if (grue) {
    lines.push(`Coverage score: ${grue.coverage_score}%`, "");
    const mentioned = (grue.grue_coverage ?? []).filter((m) => m.status === "mentioned");
    const underspecified = (grue.grue_coverage ?? []).filter((m) => m.status === "underspecified");
    const missing = (grue.grue_coverage ?? []).filter((m) => m.status === "missing");
    if (mentioned.length) {
      lines.push("### Mentioned", "");
      mentioned.forEach((m) => lines.push(`- ${m.metric}: "${(m.source_quote || "").slice(0, 80)}…"`));
      lines.push("");
    }
    if (underspecified.length) {
      lines.push("### Underspecified", "");
      underspecified.forEach((m) => lines.push(`- ${m.metric}`));
      lines.push("");
    }
    if (missing.length) {
      lines.push("### Missing", "");
      missing.forEach((m) => lines.push(`- ${m.metric}`));
      lines.push("");
    }
    if ((grue.blind_spots ?? []).length) {
      lines.push("**Blind spots:** " + grue.blind_spots.join(", "), "");
    }
  }

  // Layer 4 — Interrogation
  lines.push("## Conviction Interrogation", "");
  const red = result.layer_4?.red_list ?? [];
  const yellow = result.layer_4?.yellow_list ?? [];
  const pedigree = result.layer_4?.pedigree_flags ?? [];

  if (red.length) {
    lines.push("### Red List", "");
    red.forEach((r) => {
      lines.push(`1. ${r.question}`);
      lines.push(`   - *Why existential:* ${r.why_existential}`);
      lines.push(`   - Source: ${r.source_description}`);
      lines.push("");
    });
  }
  if (yellow.length) {
    lines.push("### Yellow List", "");
    yellow.forEach((y) => {
      lines.push(`- ${y.question}`);
      lines.push(`  - ${y.source_description}`);
      lines.push("");
    });
  }
  if (pedigree.length) {
    lines.push("### Pedigree Flags", "");
    pedigree.forEach((p) => lines.push(`- [${p.severity}] ${p.flag}`));
    lines.push("");
  }

  // Mode 2 — Attack Brief
  const brief = result.pre_meeting_attack_brief;
  if (brief) {
    lines.push("## Pre-Meeting Attack Brief", "");
    lines.push("**They will not have a good answer to this. Probe hard.**", "");
    (brief.red_list_framed ?? []).forEach((r) => {
      lines.push(`- ${r.question}`);
      lines.push(`  *${r.source_finding}*`);
      lines.push("");
    });
    lines.push("**This is where you separate polish from preparation.**", "");
    (brief.yellow_list_framed ?? []).forEach((y) => {
      lines.push(`- ${y.question}`);
      lines.push(`  *${y.source_finding}*`);
      lines.push("");
    });
    if ((brief.recommended_sequence ?? []).length) {
      lines.push("**Recommended sequence:**", "");
      brief.recommended_sequence.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }
  }

  return lines.join("\n");
}
