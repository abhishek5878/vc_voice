import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { listDeals, getDealsByVertical } = await import("@/lib/deals/db");
  const vertical = request.nextUrl.searchParams.get("vertical");
  try {
    const deals = vertical ? await getDealsByVertical(userId, vertical) : await listDeals(userId);
    return NextResponse.json(deals);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
