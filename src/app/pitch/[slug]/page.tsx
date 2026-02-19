import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PitchIntake from "@/components/PitchIntake";
import { buildVoiceProfileText } from "@/lib/voice/profile";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Always load latest profile so saved/updated evaluation style shows. */
export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug;
  return {
    title: `Pitch – ${slug} | Robin.ai`,
  };
}

async function getProfileBySlug(slug: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("robin_profiles")
    .select("user_id, bio, tone, decision_style, twitter_url, linkedin_url, substack_url, blog_url, podcast_url, extra_urls, voice_profile")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as {
    user_id: string;
    bio: string | null;
    tone: string | null;
    decision_style: string | null;
    twitter_url: string | null;
    linkedin_url: string | null;
    substack_url: string | null;
    blog_url: string | null;
    podcast_url: string | null;
    extra_urls: unknown | null;
    voice_profile: {
      tone: string;
      evaluation_heuristics: string[];
      favorite_phrases: string[];
      red_flags: string[];
      green_flags: string[];
    } | null;
  };
}

export default async function PitchPage({ params }: PageProps) {
  const rawSlug = params.slug?.toLowerCase().trim() ?? "";
  if (!rawSlug) notFound();
  const profile = await getProfileBySlug(rawSlug);
  if (!profile) notFound();

  const voiceProfileText = buildVoiceProfileText(profile);
  const headerSubtitle =
    "Paste your deck or narrative below, upload a PDF/PPT/DOCX, or fetch from a URL. Robin will stress-test it using my evaluation style.";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="w-full border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-amber-400/90 uppercase tracking-[0.2em] mb-1">Pitch to my Robin</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {profile.bio ? profile.bio.slice(0, 80) : "VC pitch portal"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Before we meet, my AI associate Robin will stress-test your pitch against my specific heuristics.
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 sm:py-6">
        <section className="mb-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-2">How I evaluate inbound</h2>
          {voiceProfileText ? (
            <p className="text-xs text-zinc-400 whitespace-pre-wrap">{voiceProfileText}</p>
          ) : (
            <>
              <p className="text-xs text-zinc-500 italic">
                This investor hasn’t set their evaluation style yet — Robin will use a generic VC voice. The stress-test will still use your deck.
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                Paste your deck or narrative below, upload a deck, or fetch from a URL. Robin will probe and help harden the pitch.
              </p>
            </>
          )}
        </section>
        <PitchIntake
          voiceProfileText={voiceProfileText}
          headerSubtitle={headerSubtitle}
          slug={rawSlug}
          investorDisplayName={profile.bio ? profile.bio.slice(0, 50).trim() : rawSlug}
        />
      </main>
    </div>
  );
}

