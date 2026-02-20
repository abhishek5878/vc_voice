import { NextRequest, NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  getDeal,
  getDealRuns,
  getClaimDrift,
  updateDealOutcome,
  updateDealStatus,
  updateDealVertical,
  setDealSharePublic,
  getClarityPercentile,
  getStrengthPercentile,
  getSlugByUserId,
} from "@/lib/deals/db";
import { getLatestDebriefForDeal } from "@/lib/debrief/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseWithToken(token);
  const { dealId } = await params;
  if (!dealId) return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
  try {
    const deal = await getDeal(dealId, userId, supabase);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [runs, claimDrift, clarityPercentile, strengthResult, debrief, pitchSlug] = await Promise.all([
      getDealRuns(dealId, supabase),
      getClaimDrift(dealId, userId, supabase),
      getClarityPercentile(userId, dealId, supabase),
      getStrengthPercentile(userId, dealId, supabase),
      getLatestDebriefForDeal(supabase, dealId),
      getSlugByUserId(userId),
    ]);
    const { percentile: strengthPercentile, totalDeals } = strengthResult;
    return NextResponse.json({
      deal,
      runs,
      claimDrift,
      clarityPercentile,
      strengthPercentile,
      totalDeals,
      debrief: debrief ?? null,
      pitchSlug: pitchSlug ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseWithToken(token);
  const { dealId } = await params;
  if (!dealId) return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
  let body: { outcome?: string; status?: string; vertical?: string; share_public?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.outcome !== undefined) {
      const v = body.outcome as "invested" | "declined" | "failed" | "3x" | "10x" | "zombie" | null;
      await updateDealOutcome(dealId, userId, v, supabase);
    }
    if (body.status !== undefined) {
      const v = body.status as "new" | "meeting" | "diligence" | "invested" | "passed";
      await updateDealStatus(dealId, userId, v, supabase);
    }
    if (body.vertical !== undefined) {
      await updateDealVertical(dealId, userId, body.vertical ?? null, supabase);
    }
    if (body.share_public !== undefined) {
      await setDealSharePublic(dealId, userId, Boolean(body.share_public), supabase);
    }
    const deal = await getDeal(dealId, userId, supabase);
    return NextResponse.json(deal);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
