import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest, getInsights } from "@/lib/deals/db";

function getAccessToken(request: NextRequest): string | null {
  const header = request.headers.get("x-supabase-access-token");
  if (header?.trim()) return header.trim();
  return null;
}

export async function GET(request: NextRequest) {
  const token = getAccessToken(request);
  const userId = await getUserIdFromRequest(token);
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
