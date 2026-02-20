import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";
import Link from "next/link";
import DebriefForm from "@/components/DebriefForm";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; dealId: string }>;
}

async function getDealAndProfile(dealId: string, slug: string) {
  const supabase = createAdminSupabase();
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, company_name, user_id")
    .eq("id", dealId)
    .maybeSingle();

  if (dealError || !deal) return null;
  const { data: profile } = await supabase
    .from("robin_profiles")
    .select("slug, display_name")
    .eq("user_id", deal.user_id)
    .maybeSingle();

  if (!profile || (profile.slug as string)?.toLowerCase() !== slug.toLowerCase()) return null;
  return {
    deal: { id: deal.id, company_name: (deal.company_name as string) || "Unnamed company" },
    displayName: (profile.display_name as string)?.trim() || slug,
  };
}

export default async function DebriefPage({ params }: PageProps) {
  unstable_noStore();
  const { slug, dealId } = await params;
  const rawSlug = slug?.toLowerCase().trim() ?? "";
  const rawDealId = dealId?.trim() ?? "";
  if (!rawSlug || !rawDealId) notFound();

  const data = await getDealAndProfile(rawDealId, rawSlug);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="w-full py-1.5 bg-zinc-900/80 border-b border-zinc-800/80">
        <p className="text-center text-[11px] font-semibold text-cyan-400/90 uppercase tracking-[0.2em]">
          Post-call debrief · {data.displayName}
        </p>
      </div>
      <header className="relative w-full overflow-hidden border-b border-zinc-800/80">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50 mb-2">
            Had the call? Drop your transcript
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl">
            Paste your call transcript and see what actually landed — and how it compares to what Robin predicted before
            the meeting.
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            <Link href={`/pitch/${rawSlug}`} className="text-cyan-400 hover:text-cyan-300 underline">
              ← Back to pitch page
            </Link>
          </p>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <section className="p-4 sm:p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <DebriefForm
            dealId={rawDealId}
            slug={rawSlug}
            investorDisplayName={data.displayName}
            companyName={data.deal.company_name}
          />
        </section>
      </main>
      <footer className="py-4 border-t border-zinc-800/60">
        <p className="text-center text-xs text-zinc-600">
          Powered by{" "}
          <a
            href="https://www.pitchrobin.work"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-cyan-400/80 transition-colors"
          >
            PitchRobin
          </a>
        </p>
      </footer>
    </div>
  );
}
