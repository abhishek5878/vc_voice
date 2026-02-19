import Link from "next/link";

export const metadata = {
  title: "Robin.ai – Your Investment Bar, Automated.",
  description:
    "Stop being the bottleneck for your own deal flow. Give founders a link to your digital twin. They stress-test their pitch in your voice; you get a triaged pipeline of evidence, not just decks.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-100 hover:text-amber-400 transition-colors">
            Robin.ai
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
              Log in
            </Link>
            <Link href="/auth" className="btn-primary text-sm">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-mesh relative pt-16 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-100 mb-5 leading-[1.15]">
            Your Investment Bar, Automated.
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-6 leading-relaxed">
            Stop being the bottleneck for your own deal flow. Give founders a link to your digital twin. They stress-test their pitch in your voice; you get a triaged pipeline of evidence, not just decks.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <Link href="/auth" className="btn-primary px-6 py-3 text-base">
              Create Your Pitch Link — Free
            </Link>
            <p className="text-xs text-zinc-500">
              No credit card required. Set up in 2 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem: The Calendar Trap */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">The problem</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-4">
            The manual triage loop is broken.
          </h2>
          <p className="text-zinc-400 text-[0.9375rem] leading-relaxed mb-4">
            You spend 20 hours a week on &quot;first-look&quot; calls just to find the one that fits your thesis. Meanwhile, your inbox is a black hole of decks you&apos;ll never open.
          </p>
          <p className="text-zinc-300 text-[0.9375rem] leading-relaxed">
            <strong className="text-amber-400/90">Robin is your first-pass filter.</strong> It&apos;s a stateful AI wired to your specific &quot;bar,&quot; interrogation style, and portfolio gaps.
          </p>
        </div>
      </section>

      {/* How It Works: The 3-Step Filter */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">How it works</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-10">
            The 3-step filter
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="py-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Step</th>
                  <th className="py-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Action</th>
                  <th className="py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Outcome</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-zinc-800/80">
                  <td className="py-4 pr-4 font-semibold text-zinc-200">1. Clone Your Bar</td>
                  <td className="py-4 pr-4 text-zinc-400">Connect your thesis, past investment memos, and tone (from &quot;Supportive&quot; to &quot;Skeptical&quot;).</td>
                  <td className="py-4 text-zinc-400">Robin learns exactly how you think and what signals you hunt for.</td>
                </tr>
                <tr className="border-b border-zinc-800/80">
                  <td className="py-4 pr-4 font-semibold text-zinc-200">2. Deploy Your Link</td>
                  <td className="py-4 pr-4 text-zinc-400">Add <span className="font-mono text-zinc-300">robin.ai/pitch/you</span> to your X bio, LinkedIn, or auto-reply.</td>
                  <td className="py-4 text-zinc-400">Founders don&apos;t just &quot;submit&quot;; they enter a high-stakes simulation of a call with <em>you</em>.</td>
                </tr>
                <tr className="border-b border-zinc-800/80">
                  <td className="py-4 pr-4 font-semibold text-zinc-200">3. High-Signal Triage</td>
                  <td className="py-4 pr-4 text-zinc-400">Review a &quot;Belief Map&quot; of every pitch.</td>
                  <td className="py-4 text-zinc-400">See exactly where a founder&apos;s narrative collapsed and where the evidence held up. <strong className="text-zinc-300">Meet, Refer, or Pass</strong> in one click.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-8 text-center">
            <Link href="/auth" className="btn-primary inline-flex px-6 py-3 text-base">
              Create Your Pitch Link — Free
            </Link>
          </div>
        </div>
      </section>

      {/* The "Post-Meeting" Edge */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-amber-500/90 mb-2">Post-meeting</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-4">
            Don&apos;t just take notes. Stress-test the truth.
          </h2>
          <p className="text-zinc-400 text-[0.9375rem] leading-relaxed mb-8">
            After the real call, drop the transcript into Robin. It identifies the <strong className="text-zinc-300">Blind Spots</strong> and <strong className="text-zinc-300">Evidence Gaps</strong> you might have missed in the moment:
          </p>
          <ul className="space-y-3 text-zinc-400 text-[0.9375rem]">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">The Conflict Report:</strong> Where did the founder&apos;s claims contradict their data?</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">The GRUE Checklist:</strong> A rigorous breakdown of Growth, Retention, Unit Economics, and Execution.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">The &quot;Next Call&quot; Script:</strong> Robin generates the 3 toughest questions you need to ask in the second partner meeting.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Why Robin vs. ChatGPT */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Why Robin</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-6">
            Robin vs. ChatGPT
          </h2>
          <blockquote className="pl-4 border-l-4 border-amber-500/60 text-zinc-300 text-sm sm:text-base leading-relaxed mb-6">
            &quot;ChatGPT is a generalist. Robin is a specialist built for the VC stack.&quot;
          </blockquote>
          <ul className="space-y-3 text-zinc-400 text-[0.9375rem]">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">It&apos;s Stateful:</strong> It remembers your pipeline and your &quot;Pass&quot; reasons to get smarter over time.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">It&apos;s Evidence-First:</strong> It doesn&apos;t just summarize; it cross-references claims against your fund&apos;s specific risk-tolerance.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span><strong className="text-zinc-300">It&apos;s Native:</strong> Markdown exports for Notion, one-click briefs for Slack, and deep Calendar integration.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-zinc-200 mb-8">Pricing</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="card-hover p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <h3 className="font-semibold text-zinc-100">Free</h3>
              <p className="mt-1 text-2xl font-semibold text-amber-500/90">$0</p>
              <p className="mt-3 text-sm text-zinc-500">5 stress-tests/month. Perfect for solo scouts.</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 relative">
              <span className="absolute top-4 right-4 text-[10px] font-medium uppercase tracking-wider text-amber-500/90">Popular</span>
              <h3 className="font-semibold text-zinc-100">Solo</h3>
              <p className="mt-1 text-2xl font-semibold text-amber-500">$99/mo</p>
              <p className="mt-3 text-sm text-zinc-400">Unlimited triage, full pipeline management, and Calendly logic.</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <h3 className="font-semibold text-zinc-100">Fund</h3>
              <p className="mt-1 text-lg font-medium text-zinc-500">Custom</p>
              <p className="mt-3 text-sm text-zinc-500">Shared deal-flow intelligence, team-wide &quot;Bar&quot; syncing, and white-labeled links.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <p className="text-zinc-400 text-sm mb-4">
              Your calendar should be a moat, not a bottleneck.
            </p>
            <Link href="/auth" className="btn-primary inline-flex px-6 py-3">
              Start Filtering Today
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <Link href="/terms.html" className="hover:text-amber-500/80 transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy.html" className="hover:text-amber-500/80 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
