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
} from "@/lib/deals/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { dealId } = await params;
  if (!dealId) return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
  try {
    const deal = await getDeal(dealId, userId);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const runs = await getDealRuns(dealId);
    const claimDrift = await getClaimDrift(dealId, userId);
    const clarityPercentile = await getClarityPercentile(userId, dealId);
    const { percentile: strengthPercentile, totalDeals } = await getStrengthPercentile(userId, dealId);
    return NextResponse.json({
      deal,
      runs,
      claimDrift,
      clarityPercentile,
      strengthPercentile,
      totalDeals,
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
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      await updateDealOutcome(dealId, userId, v);
    }
    if (body.status !== undefined) {
      const v = body.status as "new" | "meeting" | "diligence" | "invested" | "passed";
      await updateDealStatus(dealId, userId, v);
    }
    if (body.vertical !== undefined) {
      await updateDealVertical(dealId, userId, body.vertical ?? null);
    }
    if (body.share_public !== undefined) {
      await setDealSharePublic(dealId, userId, Boolean(body.share_public));
    }
    const deal = await getDeal(dealId, userId);
    return NextResponse.json(deal);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
