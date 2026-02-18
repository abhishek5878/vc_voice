import { createServerSupabase } from "@/lib/supabase/server";
import type { Deal, DealRun, FounderClaimRow } from "./types";
import { pipelineResultToRunPayload } from "./persist";
import type { PipelineResult } from "@/lib/pipeline/types";

export async function getUserIdFromRequest(accessToken: string | null): Promise<string | null> {
  if (!accessToken?.trim()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  return user.id;
}

export async function upsertDeal(
  userId: string,
  companyName: string,
  convictionScore?: number | null
): Promise<Deal> {
  const supabase = await createServerSupabase();
  const name = (companyName || "").trim() || "Unknown";
  const { data: existing } = await supabase
    .from("deals")
    .select("*")
    .eq("user_id", userId)
    .ilike("company_name", name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("deals")
      .update({
        updated_at: new Date().toISOString(),
        ...(convictionScore !== undefined && { conviction_score: convictionScore }),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return updated as Deal;
  }

  const { data: inserted, error } = await supabase
    .from("deals")
    .insert({
      user_id: userId,
      company_name: name,
      status: "new",
    })
    .select()
    .single();
  if (error) throw error;
  return inserted as Deal;
}

export async function insertDealRun(dealId: string, result: PipelineResult): Promise<DealRun> {
  const supabase = await createServerSupabase();
  const payload = pipelineResultToRunPayload(result);
  const { data, error } = await supabase
    .from("deal_runs")
    .insert({
      deal_id: dealId,
      mode: payload.mode,
      report_json: payload.report_json,
      red_flags: payload.red_flags,
      yellow_flags: payload.yellow_flags,
      claims: payload.claims,
      grue_scores: payload.grue_scores,
      risk_score: payload.risk_score,
      clarity_score: payload.clarity_score,
      interrogation_resistance: payload.interrogation_resistance,
      resistance_score: payload.resistance_score ?? null,
      deal_strength: payload.deal_strength ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DealRun;
}

function claimSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (na === nb) return 1;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  let match = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) match++;
  });
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB))).size;
  return union === 0 ? 0 : match / union;
}

export async function insertFounderClaims(
  dealId: string,
  runId: string,
  claims: { claim: string; source_quote: string | null; status: string }[]
): Promise<void> {
  const supabase = await createServerSupabase();
  const existing = await supabase
    .from("founder_claims")
    .select("id, claim_text, status")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  const existingClaims = (existing.data ?? []) as { id: string; claim_text: string; status: string }[];
  const SIMILARITY_THRESHOLD = 0.4;

  for (const c of claims) {
    const claimText = c.claim?.trim() || "";
    if (!claimText) continue;
    let status = c.status as "verified" | "unverified" | "contradicted" | "changed";
    const similar = existingClaims.find(
      (e) => claimSimilarity(e.claim_text, claimText) >= SIMILARITY_THRESHOLD
    );
    if (similar && similar.claim_text !== claimText) status = "changed";

    await supabase.from("founder_claims").insert({
      deal_id: dealId,
      run_id: runId,
      claim_text: claimText,
      source_quote: c.source_quote ?? null,
      status,
    });
  }
}

export async function listDeals(userId: string): Promise<Deal[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function getDeal(dealId: string, userId: string): Promise<Deal | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as Deal;
}

export async function getDealRuns(dealId: string): Promise<DealRun[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("deal_runs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealRun[];
}

export async function getClaimDrift(dealId: string, userId: string): Promise<FounderClaimRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("founder_claims")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as FounderClaimRow[];
  const deal = await getDeal(dealId, userId);
  if (!deal) return [];
  return rows;
}

export async function updateDealOutcome(
  dealId: string,
  userId: string,
  outcome: Deal["outcome"]
): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("deals").update({ outcome }).eq("id", dealId).eq("user_id", userId);
}

export async function updateDealStatus(
  dealId: string,
  userId: string,
  status: Deal["status"]
): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("deals").update({ status }).eq("id", dealId).eq("user_id", userId);
}

export async function updateDealVertical(
  dealId: string,
  userId: string,
  vertical: string | null
): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("deals").update({ vertical }).eq("id", dealId).eq("user_id", userId);
}

export async function setDealSharePublic(dealId: string, userId: string, share: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("deals").update({ share_public: share }).eq("id", dealId).eq("user_id", userId);
}

export async function getDealPublic(dealId: string): Promise<Deal | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("share_public", true)
    .single();
  if (error || !data) return null;
  return data as Deal;
}

export async function getDealRunsForSnapshot(dealId: string): Promise<DealRun[]> {
  return getDealRuns(dealId);
}

export async function getInsights(userId: string): Promise<{
  redFlagFrequencyFailed: Record<string, number>;
  redFlagFrequencySuccess: Record<string, number>;
  avgClarityWinners: number;
  avgClarityFailed: number;
  avgClarityDeclined: number;
  avgRiskByOutcome: Record<string, number>;
  topGrueDimension: string | null;
}> {
  const deals = await listDeals(userId);
  const failedOutcomes = ["failed", "zombie"];
  const declinedOutcome = "declined";
  const winnerOutcomes = ["3x", "10x"];
  const successOutcomes = ["invested", "3x", "10x"];
  const redFlagFrequencyFailed: Record<string, number> = {};
  const redFlagFrequencySuccess: Record<string, number> = {};
  let claritySumSuccess = 0;
  let clarityCountSuccess = 0;
  let claritySumFailed = 0;
  let clarityCountFailed = 0;
  let claritySumDeclined = 0;
  let clarityCountDeclined = 0;
  const riskByOutcome: Record<string, { sum: number; count: number }> = {};
  const grueDimensionCount: Record<string, number> = {};

  for (const deal of deals) {
    const runs = await getDealRuns(deal.id);
    const outcome = deal.outcome ?? "";
    const isFailed = failedOutcomes.includes(outcome);
    const isDeclined = outcome === declinedOutcome;
    const isSuccess = successOutcomes.includes(outcome);
    const isWinner = winnerOutcomes.includes(outcome);

    for (const run of runs) {
      const redFlags = (run.red_flags ?? []) as { question: string }[];
      redFlags.forEach((r) => {
        const key = r.question?.slice(0, 80) ?? "other";
        if (isFailed) redFlagFrequencyFailed[key] = (redFlagFrequencyFailed[key] ?? 0) + 1;
        if (isSuccess) redFlagFrequencySuccess[key] = (redFlagFrequencySuccess[key] ?? 0) + 1;
      });
      if (run.clarity_score != null) {
        if (isWinner) {
          claritySumSuccess += run.clarity_score;
          clarityCountSuccess++;
        }
        if (isFailed) {
          claritySumFailed += run.clarity_score;
          clarityCountFailed++;
        }
        if (isDeclined) {
          claritySumDeclined += run.clarity_score;
          clarityCountDeclined++;
        }
      }
      if (run.risk_score != null && outcome) {
        if (!riskByOutcome[outcome]) riskByOutcome[outcome] = { sum: 0, count: 0 };
        riskByOutcome[outcome].sum += run.risk_score;
        riskByOutcome[outcome].count++;
      }
      const grue = (run.grue_scores ?? []) as { metric: string; domain: string }[];
      grue.forEach((g) => {
        const d = g.domain ?? "other";
        grueDimensionCount[d] = (grueDimensionCount[d] ?? 0) + 1;
      });
    }
  }

  const avgRiskByOutcome: Record<string, number> = {};
  for (const [out, v] of Object.entries(riskByOutcome)) {
    avgRiskByOutcome[out] = v.count > 0 ? v.sum / v.count : 0;
  }

  const entries = Object.entries(grueDimensionCount).sort((a, b) => b[1] - a[1]);
  return {
    redFlagFrequencyFailed,
    redFlagFrequencySuccess,
    avgClarityWinners: clarityCountSuccess > 0 ? claritySumSuccess / clarityCountSuccess : 0,
    avgClarityFailed: clarityCountFailed > 0 ? claritySumFailed / clarityCountFailed : 0,
    avgClarityDeclined: clarityCountDeclined > 0 ? claritySumDeclined / clarityCountDeclined : 0,
    avgRiskByOutcome,
    topGrueDimension: entries[0]?.[0] ?? null,
  };
}

export async function getDealsByVertical(userId: string, vertical: string | null): Promise<Deal[]> {
  const all = await listDeals(userId);
  if (!vertical?.trim()) return all;
  return all.filter((d) => (d.vertical ?? "").toLowerCase() === vertical.toLowerCase());
}

export async function getClarityPercentile(userId: string, dealId: string): Promise<number | null> {
  const { computePercentile } = await import("@/lib/percentile");
  const deals = await listDeals(userId);
  const values: number[] = [];
  let currentValue: number | null = null;
  for (const d of deals) {
    const runs = await getDealRuns(d.id);
    const last = runs[0];
    if (last?.clarity_score != null) {
      values.push(last.clarity_score);
      if (d.id === dealId) currentValue = last.clarity_score;
    }
  }
  if (currentValue == null) return null;
  return computePercentile(currentValue, values);
}

export async function getStrengthPercentile(userId: string, dealId: string): Promise<{ percentile: number | null; totalDeals: number }> {
  const { computePercentile } = await import("@/lib/percentile");
  const deals = await listDeals(userId);
  const values: number[] = [];
  let currentValue: number | null = null;
  for (const d of deals) {
    const runs = await getDealRuns(d.id);
    const last = runs[0];
    const strength = last?.deal_strength ?? (last?.risk_score != null ? 100 - last.risk_score : null);
    if (strength != null) {
      values.push(strength);
      if (d.id === dealId) currentValue = strength;
    }
  }
  const totalDeals = values.length;
  const percentile = currentValue != null ? computePercentile(currentValue, values) : null;
  return { percentile, totalDeals };
}
