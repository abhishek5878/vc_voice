import type { PipelineResult } from "@/lib/pipeline/types";
import type { DealRun, RedFlagItem, YellowFlagItem, ClaimItem, GrueScoreItem } from "./types";
import {
  computeRiskScore as scoringRisk,
  computeClarityScore as scoringClarity,
  computeResistanceScore,
  computeDealStrength,
} from "@/lib/scoring";

function extractRedFlags(result: PipelineResult): RedFlagItem[] {
  const red: RedFlagItem[] = [];
  const brief = result.pre_meeting_attack_brief;
  if (brief?.red_list_framed?.length) {
    brief.red_list_framed.forEach((r) => {
      red.push({
        question: r.question ?? "",
        source_description: r.source_finding,
        why_existential: r.framing,
      });
    });
  }
  if (result.layer_4?.red_list?.length) {
    result.layer_4.red_list.forEach((r) => {
      red.push({
        question: r.question ?? "",
        source_description: r.source_description,
        why_existential: r.why_existential,
      });
    });
  }
  return red;
}

function extractYellowFlags(result: PipelineResult): YellowFlagItem[] {
  const yellow: YellowFlagItem[] = [];
  const brief = result.pre_meeting_attack_brief;
  if (brief?.yellow_list_framed?.length) {
    brief.yellow_list_framed.forEach((y) => {
      yellow.push({
        question: y.question ?? "",
        source_description: y.source_finding,
      });
    });
  }
  if (result.layer_4?.yellow_list?.length) {
    result.layer_4.yellow_list.forEach((y) => {
      yellow.push({
        question: y.question ?? "",
        source_description: y.source_description,
      });
    });
  }
  return yellow;
}

export function extractClaims(result: PipelineResult): ClaimItem[] {
  const claims = result.layer_1?.claims ?? [];
  return claims.map((c) => ({
    claim: c.claim ?? "",
    source_quote: c.source_quote ?? null,
    status: c.status ?? "unverified",
    category: c.category,
  }));
}

function extractGrueScores(result: PipelineResult): GrueScoreItem[] | null {
  const grue = result.layer_3?.grue_coverage;
  if (!grue?.length) return null;
  return grue.map((g) => ({
    metric: g.metric ?? "",
    domain: g.domain ?? "",
    status: g.status ?? "",
  }));
}

export function pipelineResultToRunPayload(
  result: PipelineResult
): Omit<DealRun, "id" | "deal_id" | "created_at"> {
  const redFlags = extractRedFlags(result);
  const yellowFlags = extractYellowFlags(result);
  const claims = extractClaims(result);
  const grueScores = extractGrueScores(result);
  const totalClaims = claims.length;
  const verifiedClaims = claims.filter((c) => c.status === "verified").length;
  const contradictions = claims.filter((c) => c.status === "contradicted").length;
  const grueCoverage = result.layer_3?.grue_coverage ?? [];
  const totalGrue = grueCoverage.length || 1;
  const grueCovered = grueCoverage.filter((g) => g.status === "mentioned").length;
  const grueMissing = grueCoverage.filter((g) => g.status === "missing" || g.status === "underspecified").length;
  const unverifiedRatio = totalClaims > 0 ? (totalClaims - verifiedClaims) / totalClaims : 0;

  const riskScore = scoringRisk({
    redFlags: redFlags.length,
    contradictions,
    grueMissing,
    unverifiedRatio,
  });
  const clarityScore = scoringClarity({
    verifiedClaims,
    totalClaims: totalClaims || 1,
    contradictions,
    grueCovered,
    totalGrue,
  });
  const hardQuestions = redFlags.length || 1;
  const directAnswers = Math.min(verifiedClaims, redFlags.length);
  const deflections = Math.max(0, hardQuestions - directAnswers);
  const resistanceScore = computeResistanceScore({
    hardQuestions,
    directAnswers,
    deflections,
  });
  const dealStrength = computeDealStrength({
    clarity: clarityScore,
    risk: riskScore,
    resistance: resistanceScore,
  });
  const totalQ = redFlags.length + yellowFlags.length;
  const interrogationResistance =
    totalQ > 0 ? Math.round((1 - redFlags.length / totalQ) * 100) / 100 : 1;

  return {
    mode: result.mode as 1 | 2 | 3,
    report_json: result as unknown,
    red_flags: redFlags,
    yellow_flags: yellowFlags,
    claims,
    grue_scores: grueScores,
    risk_score: riskScore,
    clarity_score: clarityScore,
    interrogation_resistance: interrogationResistance,
    resistance_score: resistanceScore,
    deal_strength: dealStrength,
  };
}

export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ") || "Unknown";
}
