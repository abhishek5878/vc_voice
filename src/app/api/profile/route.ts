import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";
import { getRobinProfile, upsertRobinProfile } from "@/lib/voice/profile";

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
    const profile = await getRobinProfile(userId);
    return NextResponse.json(profile ?? { user_id: userId, voice_profile: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = getAccessToken(request);
  const userId = await getUserIdFromRequest(token);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    bio?: string | null;
    tone?: string | null;
    decision_style?: string | null;
    twitter_url?: string | null;
    linkedin_url?: string | null;
    substack_url?: string | null;
    blog_url?: string | null;
    podcast_url?: string | null;
    extra_urls?: string[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = {
    bio: body.bio ?? null,
    tone: body.tone ?? null,
    decision_style: body.decision_style ?? null,
    twitter_url: body.twitter_url ?? null,
    linkedin_url: body.linkedin_url ?? null,
    substack_url: body.substack_url ?? null,
    blog_url: body.blog_url ?? null,
    podcast_url: body.podcast_url ?? null,
    extra_urls: body.extra_urls ? body.extra_urls : null,
  };

  try {
    const saved = await upsertRobinProfile(userId, updates);
    return NextResponse.json(saved);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

