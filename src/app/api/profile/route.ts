import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/deals/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getRobinProfile, upsertRobinProfile } from "@/lib/voice/profile";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e != null && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createServerSupabaseWithToken(token);
    const profile = await getRobinProfile(userId, supabase);
    return NextResponse.json(profile ?? { user_id: userId, voice_profile: null });
  } catch (e) {
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userId = await getUserIdFromRequest(request);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    slug?: string | null;
    display_name?: string | null;
    email?: string | null;
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

  const slug = (body.slug ?? "").trim().toLowerCase();
  if (slug) {
    const valid = /^[a-z0-9-]{3,32}$/.test(slug);
    if (!valid) {
      return NextResponse.json(
        { error: "Slug must be 3-32 chars, lowercase letters, numbers, or dashes." },
        { status: 400 }
      );
    }
  }

  const updates = {
    slug: slug || null,
    display_name: typeof body.display_name === "string" ? (body.display_name.trim() || null) : null,
    email: typeof body.email === "string" ? (body.email.trim() || null) : null,
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
    const admin = createAdminSupabase();

    // Enforce slug uniqueness: only reject if a different user already has this slug
    if (slug) {
      const { data: existing } = await admin
        .from("robin_profiles")
        .select("user_id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing && existing.user_id !== userId) {
        return NextResponse.json({ error: "This slug is already taken. Try another." }, { status: 400 });
      }
    }

    // Use admin client so the upsert always persists (RLS can block with user token e.g. anonymous)
    const saved = await upsertRobinProfile(userId, updates, admin);
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}

