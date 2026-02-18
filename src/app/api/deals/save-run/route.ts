import { NextRequest, NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  upsertDeal,
  insertDealRun,
  insertFounderClaims,
} from "@/lib/deals/db";
import { extractClaims } from "@/lib/deals/persist";
import type { PipelineResult } from "@/lib/pipeline/types";

function getAccessToken(request: NextRequest): string | null {
  const header = request.headers.get("x-supabase-access-token");
  if (header?.trim()) return header.trim();
  return null;
}

export async function POST(request: NextRequest) {
  const token = getAccessToken(request);
  const userId = await getUserIdFromRequest(token);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save this deal." }, { status: 401 });
  }
  let body: { companyName: string; report: PipelineResult };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const report = body.report as PipelineResult | undefined;
  if (!companyName) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }
  if (!report?.layer_1 || !report?.layer_4) {
    return NextResponse.json({ error: "Valid report (pipeline result) is required" }, { status: 400 });
  }
  try {
    const deal = await upsertDeal(userId, companyName);
    const run = await insertDealRun(deal.id, report);
    const claims = extractClaims(report);
    await insertFounderClaims(
      deal.id,
      run.id,
      claims.map((c) => ({ claim: c.claim, source_quote: c.source_quote, status: c.status }))
    );
    return NextResponse.json({ dealId: deal.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
