import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest, getInsights } from "@/lib/deals/db";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const insights = await getInsights(userId);
    return NextResponse.json(insights);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
