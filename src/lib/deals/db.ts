import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Deal, DealRun, FounderClaimRow } from "./types";
import { pipelineResultToRunPayload } from "./persist";
import type { PipelineResult } from "@/lib/pipeline/types";

/**
 * Resolve user ID from Supabase access token (anonymous or email user).
 * After passcode, client signs in anonymously so each visitor gets their own user and profile.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  if (!accessToken) return null;
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
  convictionScore?: number | null,
  supabase?: SupabaseClient
): Promise<Deal> {
  const client = supabase ?? (await createServerSupabase());
  const name = (companyName || "").trim() || "Unknown";
  const { data: existing } = await client
    .from("deals")
    .select("*")
    .eq("user_id", userId)
    .ilike("company_name", name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await client
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

  const { data: inserted, error } = await client
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

export async function insertDealRun(
  dealId: string,
  result: PipelineResult,
  supabase?: SupabaseClient
): Promise<DealRun> {
  const client = supabase ?? (await createServerSupabase());
  return insertDealRunWithClient(client, dealId, result);
}

/** Use with admin client for server-initiated writes (e.g. inbound pitch submit). */
export async function insertDealRunWithClient(
  supabase: SupabaseClient,
  dealId: string,
  result: PipelineResult
): Promise<DealRun> {
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
  claims: { claim: string; source_quote: string | null; status: string }[],
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase ?? (await createServerSupabase());
  return insertFounderClaimsWithClient(client, dealId, runId, claims);
}

/** Use with admin client for server-initiated writes (e.g. inbound pitch submit). */
export async function insertFounderClaimsWithClient(
  supabase: SupabaseClient,
  dealId: string,
  runId: string,
  claims: { claim: string; source_quote: string | null; status: string }[]
): Promise<void> {
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

export async function listDeals(userId: string, supabase?: SupabaseClient): Promise<Deal[]> {
  const client = supabase ?? (await createServerSupabase());
  const { data, error } = await client
    .from("deals")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function getDeal(dealId: string, userId: string, supabase?: SupabaseClient): Promise<Deal | null> {
  const client = supabase ?? (await createServerSupabase());
  const { data, error } = await client
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as Deal;
}

export async function getDealRuns(dealId: string, supabase?: SupabaseClient): Promise<DealRun[]> {
  const client = supabase ?? (await createServerSupabase());
  const { data, error } = await client
    .from("deal_runs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealRun[];
}

export async function getClaimDrift(dealId: string, userId: string, supabase?: SupabaseClient): Promise<FounderClaimRow[]> {
  const client = supabase ?? (await createServerSupabase());
  const { data, error } = await client
    .from("founder_claims")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as FounderClaimRow[];
  const deal = await getDeal(dealId, userId, client);
  if (!deal) return [];
  return rows;
}

export async function updateDealOutcome(
  dealId: string,
  userId: string,
  outcome: Deal["outcome"],
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase ?? (await createServerSupabase());
  await client.from("deals").update({ outcome }).eq("id", dealId).eq("user_id", userId);
}

export async function updateDealStatus(
  dealId: string,
  userId: string,
  status: Deal["status"],
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase ?? (await createServerSupabase());
  await client.from("deals").update({ status }).eq("id", dealId).eq("user_id", userId);
}

export async function updateDealVertical(
  dealId: string,
  userId: string,
  vertical: string | null,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase ?? (await createServerSupabase());
  await client.from("deals").update({ vertical }).eq("id", dealId).eq("user_id", userId);
}

export async function setDealSharePublic(dealId: string, userId: string, share: boolean, supabase?: SupabaseClient): Promise<void> {
  const client = supabase ?? (await createServerSupabase());
  await client.from("deals").update({ share_public: share }).eq("id", dealId).eq("user_id", userId);
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

/** Public snapshot page: load deal by id when share_public (uses admin so unauthenticated visitors see data). */
export async function getDealPublicForSnapshot(dealId: string): Promise<Deal | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("share_public", true)
    .single();
  if (error || !data) return null;
  return data as Deal;
}

/** For /result/[sessionId]: get deal by id only (no auth). Uses admin so public result page works without user session. */
export async function getDealByIdForResult(dealId: string): Promise<{ id: string; company_name: string; share_public: boolean; user_id: string } | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("deals")
    .select("id, company_name, share_public, user_id")
    .eq("id", dealId)
    .single();
  if (error || !data) return null;
  return data as { id: string; company_name: string; share_public: boolean; user_id: string };
}

/** Get VC pitch page slug by user_id (for result page CTA). Uses admin so result page works without session. */
export async function getSlugByUserId(userId: string): Promise<string | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("robin_profiles")
    .select("slug")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.slug) return null;
  return (data.slug as string) ?? null;
}

/** Get VC display name and slug for snapshot/OG (public). */
export async function getVcDisplayByUserId(userId: string): Promise<{ slug: string | null; display_name: string | null }> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("robin_profiles")
    .select("slug, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { slug: null, display_name: null };
  return {
    slug: (data.slug as string) ?? null,
    display_name: (data.display_name as string)?.trim() || null,
  };
}

export async function getDealRunsForSnapshot(dealId: string): Promise<DealRun[]> {
  return getDealRuns(dealId);
}

/** Deal runs for public /result page (bypasses RLS via admin). */
export async function getDealRunsForResult(dealId: string): Promise<DealRun[]> {
  const client = createAdminSupabase();
  const { data, error } = await client
    .from("deal_runs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealRun[];
}

export async function getInsights(userId: string, supabase?: SupabaseClient): Promise<{
  redFlagFrequencyFailed: Record<string, number>;
  redFlagFrequencySuccess: Record<string, number>;
  avgClarityWinners: number;
  avgClarityFailed: number;
  avgClarityDeclined: number;
  avgRiskByOutcome: Record<string, number>;
  topGrueDimension: string | null;
}> {
  const deals = await listDeals(userId, supabase);
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
    const runs = await getDealRuns(deal.id, supabase);
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

export async function getDealsByVertical(userId: string, vertical: string | null, supabase?: SupabaseClient): Promise<Deal[]> {
  const all = await listDeals(userId, supabase);
  if (!vertical?.trim()) return all;
  return all.filter((d) => (d.vertical ?? "").toLowerCase() === vertical.toLowerCase());
}

export async function getClarityPercentile(userId: string, dealId: string, supabase?: SupabaseClient): Promise<number | null> {
  const { computePercentile } = await import("@/lib/percentile");
  const deals = await listDeals(userId, supabase);
  const values: number[] = [];
  let currentValue: number | null = null;
  for (const d of deals) {
    const runs = await getDealRuns(d.id, supabase);
    const last = runs[0];
    if (last?.clarity_score != null) {
      values.push(last.clarity_score);
      if (d.id === dealId) currentValue = last.clarity_score;
    }
  }
  if (currentValue == null) return null;
  return computePercentile(currentValue, values);
}

export async function getStrengthPercentile(userId: string, dealId: string, supabase?: SupabaseClient): Promise<{ percentile: number | null; totalDeals: number; rank: number | null }> {
  const { computePercentile } = await import("@/lib/percentile");
  const deals = await listDeals(userId, supabase);
  const entries: { dealId: string; strength: number; clarity: number }[] = [];
  for (const d of deals) {
    const runs = await getDealRuns(d.id, supabase);
    const last = runs[0];
    const strength = last?.deal_strength ?? (last?.risk_score != null ? 100 - last.risk_score : null);
    const clarity = last?.clarity_score ?? 0;
    if (strength != null) {
      entries.push({ dealId: d.id, strength, clarity });
    }
  }
  const totalDeals = entries.length;
  const values = entries.map((e) => e.strength);
  const currentValue = entries.find((e) => e.dealId === dealId)?.strength ?? null;
  const percentile = currentValue != null ? computePercentile(currentValue, values) : null;
  // Ordinal rank with tie-break: strength desc, then clarity desc, then dealId
  entries.sort((a, b) => b.strength - a.strength || b.clarity - a.clarity || a.dealId.localeCompare(b.dealId));
  const rankIndex = entries.findIndex((e) => e.dealId === dealId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  return { percentile, totalDeals, rank };
}
