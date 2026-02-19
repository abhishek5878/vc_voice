import { NextRequest, NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  upsertDeal,
  insertDealRun,
  insertFounderClaims,
} from "@/lib/deals/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";
import { extractClaims } from "@/lib/deals/persist";
import type { PipelineResult } from "@/lib/pipeline/types";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Sign in to save this deal." }, { status: 401 });
  }
  const supabase = createServerSupabaseWithToken(token);
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
    const deal = await upsertDeal(userId, companyName, undefined, supabase);
    const run = await insertDealRun(deal.id, report, supabase);
    const claims = extractClaims(report);
    await insertFounderClaims(
      deal.id,
      run.id,
      claims.map((c) => ({ claim: c.claim, source_quote: c.source_quote, status: c.status })),
      supabase
    );
    return NextResponse.json({ dealId: deal.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
