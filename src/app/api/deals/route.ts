import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseWithToken(token);
  const { listDeals, getDealsByVertical } = await import("@/lib/deals/db");
  const vertical = request.nextUrl.searchParams.get("vertical");
  try {
    const deals = vertical ? await getDealsByVertical(userId, vertical, supabase) : await listDeals(userId, supabase);
    return NextResponse.json(deals);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
