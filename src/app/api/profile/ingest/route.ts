import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";
import { buildVoiceProfileFromLinks, getRobinProfile, upsertRobinProfile } from "@/lib/voice/profile";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseWithToken(token);

  let body: { manualText?: string | null } = {};
  try {
    if (request.body) {
      body = (await request.json()) as { manualText?: string | null };
    }
  } catch {
    // ignore, manualText stays undefined
  }
  const manualText = body.manualText?.trim() || undefined;

  try {
    const existing = await getRobinProfile(userId, supabase);
    const urls: string[] = [];
    const push = (v: string | null | undefined) => {
      if (v && v.trim()) urls.push(v.trim());
    };
    if (existing) {
      push(existing.twitter_url);
      push(existing.linkedin_url);
      push(existing.substack_url);
      push(existing.blog_url);
      push(existing.podcast_url);
      const extras = Array.isArray(existing.extra_urls) ? (existing.extra_urls as string[]) : [];
      extras.forEach((u) => push(u));
    }

    await upsertRobinProfile(userId, { scrape_status: "running", scrape_error: null }, supabase);

    const maxCrawlMs = 5 * 60 * 1000; // 5 minutes
    const profile = await buildVoiceProfileFromLinks({
      urls,
      provider: "openai",
      model: "gpt-4o-mini",
      manualText,
      maxCrawlMs,
    });

    if (!profile) {
      await upsertRobinProfile(
        userId,
        { scrape_status: "error", scrape_error: "insufficient_content", last_scraped_at: new Date().toISOString() },
        supabase
      );
      return NextResponse.json(
        {
          user_id: userId,
          status: "insufficient_content",
          message: "We scraped your links for up to 5 minutes but need a bit more. Describe your investment style in 30 seconds (type or speak and paste the transcript).",
        },
        { status: 200 }
      );
    }

    const saved = await upsertRobinProfile(
      userId,
      { voice_profile: profile, scrape_status: "done", scrape_error: null, last_scraped_at: new Date().toISOString() },
      supabase
    );

    return NextResponse.json({
      user_id: userId,
      status: "ok",
      voice_profile: saved.voice_profile,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await upsertRobinProfile(
      userId,
      { scrape_status: "error", scrape_error: message, last_scraped_at: new Date().toISOString() },
      supabase
    ).catch(() => undefined);
    return NextResponse.json({ error: "Ingest failed", detail: message }, { status: 500 });
  }
}

