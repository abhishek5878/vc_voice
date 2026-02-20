import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildVoiceProfileFromLinks, getRobinProfile, upsertRobinProfile } from "@/lib/voice/profile";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();

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
    const existing = await getRobinProfile(userId, admin);
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

    await upsertRobinProfile(userId, { scrape_status: "running", scrape_error: null }, admin);

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
        admin
      );
      const noLinks = urls.length === 0;
      const message = noLinks
        ? "Add at least one link (LinkedIn, Twitter, blog, etc.) above, or describe your style below. You can type or use the voice option (record or upload)."
        : "We couldn't get enough from your links yet. Describe your investment style below—you can type or use the voice option (record or upload a short clip).";
      return NextResponse.json(
        {
          user_id: userId,
          status: "insufficient_content",
          message,
        },
        { status: 200 }
      );
    }

    const saved = await upsertRobinProfile(
      userId,
      { voice_profile: profile, scrape_status: "done", scrape_error: null, last_scraped_at: new Date().toISOString() },
      admin
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
      admin
    ).catch(() => undefined);
    return NextResponse.json({ error: "Ingest failed", detail: message }, { status: 500 });
  }
}

