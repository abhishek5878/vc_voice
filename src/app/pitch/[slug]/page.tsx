import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";
import type { Metadata } from "next";
import PitchIntake from "@/components/PitchIntake";
import CopyablePitchLink from "@/components/CopyablePitchLink";
import CollapsibleHowIEvaluate from "@/components/CollapsibleHowIEvaluate";
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
    title: `Pitch – ${slug} | PitchRobin`,
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
  unstable_noStore();
  const rawSlug = params.slug?.toLowerCase().trim() ?? "";
  if (!rawSlug) notFound();
  const profile = await getProfileBySlug(rawSlug);
  if (!profile) notFound();

  const voiceProfileText = buildVoiceProfileText(profile);
  const displayName = profile.bio ? profile.bio.split(/[,·]| at /)[0]?.trim() || profile.bio.slice(0, 40).trim() : rawSlug;
  const headerSubtitle =
    "Paste your deck or narrative below, upload a PDF/PPT/DOCX, or fetch from a URL. I’ll stress-test it in my voice and style.";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="relative w-full overflow-hidden border-b border-zinc-800/80">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <p className="text-[11px] font-medium text-cyan-400/90 uppercase tracking-[0.25em] mb-2">
            Pitch to {displayName}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50 mb-2">
            Stress-test your pitch in my voice
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl">
            Before we meet, my AI will run your deck through my real evaluation style: the same heuristics, tone, and questions I use on first calls.
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            What happens next: you’ll answer a few questions in my style, then you can submit to my pipeline or get pointers to sharpen the pitch.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Your link:</span>
            <CopyablePitchLink slug={rawSlug} />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <section className="mb-8 p-4 sm:p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">How I evaluate</h2>
          <CollapsibleHowIEvaluate
            voiceProfileText={voiceProfileText}
            noProfileCopy={
              <p className="text-[15px] text-zinc-400">
                Robin will stress-test your pitch against proven VC heuristics and flag gaps in your narrative.
              </p>
            }
          />
        </section>
        <PitchIntake
          voiceProfileText={voiceProfileText}
          headerSubtitle={headerSubtitle}
          slug={rawSlug}
          investorDisplayName={profile.bio ? profile.bio.slice(0, 50).trim() : rawSlug}
        />
      </main>
      <footer className="py-4 border-t border-zinc-800/60">
        <p className="text-center text-xs text-zinc-600">
          Powered by <a href="https://www.pitchrobin.work" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400/80 transition-colors">PitchRobin</a>
        </p>
      </footer>
    </div>
  );
}

