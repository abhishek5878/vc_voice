import Link from "next/link";
import FAQAccordion from "@/components/landing/FAQAccordion";

export const metadata = {
  title: "PitchRobin – Your Investment Bar, Automated.",
  description:
    "Clone your exact decision criteria. Let founders pitch your digital twin. Get Belief Maps, not just decks.",
};

function IconClone() {
  return (
    <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function IconDeploy() {
  return (
    <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function IconTriage() {
  return (
    <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100 hover:text-cyan-400 transition-colors">
            PitchRobin
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm text-slate-400 hover:text-cyan-400 transition-colors">
              Log in
            </Link>
            <Link href="/auth" className="btn-primary text-sm">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-mesh hero-grid relative pt-20 pb-24 sm:pt-24 sm:pb-32 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-50 mb-4 leading-[1.1]">
                Your Investment Bar, Automated
              </h1>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Clone your exact decision criteria. Let founders pitch your digital twin. Get Belief Maps, not just decks.
              </p>
              <ul className="space-y-2 mb-8 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Belief Map per pitch: evidence held vs. collapsed
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Meet, Refer, or Pass in one click
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Your bar, your tone. No generic chatbot.
                </li>
              </ul>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link href="/auth" className="btn-primary px-8 py-4 text-base w-full sm:w-auto">
                  Create Your Pitch Link (Free)
                </Link>
                <p className="text-xs text-slate-500">No credit card · Set up in 2 minutes</p>
              </div>
              <p className="mt-6 inline-flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <IconLock /> Stateful &amp; Private
                </span>
                · Your data never trains public models
              </p>
            </div>
            {/* Hero: Belief Map mock */}
            <div className="landing-fade-in rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-2xl shadow-black/40 overflow-hidden">
              <div className="h-8 px-4 flex items-center gap-2 border-b border-slate-700/80 bg-slate-800/50">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-500 ml-2">Belief Map · Acme Inc.</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Evidence zones</span>
                  <span className="text-cyan-400 font-medium">Meets your bar → Calendly</span>
                </div>
                <div className="h-24 rounded-lg bg-slate-800/80 border border-slate-600/50 flex">
                  <div className="w-1/3 rounded-l-lg bg-emerald-500/20 border-r border-slate-600/50 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-emerald-400">Held</span>
                  </div>
                  <div className="w-1/3 bg-amber-500/10 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-amber-400">Partial</span>
                  </div>
                  <div className="w-1/3 rounded-r-lg bg-red-500/20 border-l border-slate-600/50 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-red-400">Gap flagged</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 h-8 rounded bg-cyan-500/20 border border-cyan-400/30 text-center text-[10px] text-cyan-300 flex items-center justify-center">Meet</div>
                  <div className="flex-1 h-8 rounded bg-slate-600/50 text-center text-[10px] text-slate-400 flex items-center justify-center">Refer</div>
                  <div className="flex-1 h-8 rounded bg-slate-600/50 text-center text-[10px] text-slate-400 flex items-center justify-center">Pass</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 sm:py-20 border-t border-slate-800/60 bg-slate-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">The problem</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-4">
            The manual triage loop is broken
          </h2>
          <p className="text-slate-400 leading-relaxed mb-4">
            20 hours a week on first-look calls. Inbox full of decks you&apos;ll never open.
          </p>
          <p className="text-slate-300">
            <strong className="text-cyan-400">Robin is your first-pass filter</strong>: stateful AI wired to your bar, interrogation style, and portfolio gaps.
          </p>
        </div>
      </section>

      {/* How it works: visual cards */}
      <section id="how-it-works" className="py-16 sm:py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-cyan-400/90 mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-12">
            The 3-step filter
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card-hover p-6 rounded-2xl border border-slate-700/80 bg-slate-800/30">
              <div className="mb-4">
                <IconClone />
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">1. Clone Your Bar</h3>
              <p className="text-sm text-slate-400 mb-3">Connect your thesis, memos, and tone (Supportive → Skeptical).</p>
              <p className="text-xs text-cyan-300/90">Robin learns how you think and what signals you hunt for.</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border border-slate-700/80 bg-slate-800/30">
              <div className="mb-4">
                <IconDeploy />
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">2. Deploy Your Link</h3>
              <p className="text-sm text-slate-400 mb-3">Add <code className="text-slate-300 bg-slate-700/50 px-1 rounded">pitchrobin.work/pitch/you</code> to X, LinkedIn, or auto-reply.</p>
              <p className="text-xs text-cyan-300/90">Founders enter a simulation of a call with you, not just &quot;submit.&quot;</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border border-slate-700/80 bg-slate-800/30">
              <div className="mb-4">
                <IconTriage />
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">3. High-Signal Triage</h3>
              <p className="text-sm text-slate-400 mb-3">Review a Belief Map for every pitch.</p>
              <p className="text-xs text-cyan-300/90">See where narrative collapsed and evidence held. Meet, Refer, or Pass in one click.</p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link href="/auth" className="btn-primary px-8 py-3">
              Create Your Pitch Link (Free)
            </Link>
          </div>
        </div>
      </section>

      {/* See Robin in Action */}
      <section className="py-16 sm:py-20 border-t border-slate-800/60 bg-slate-900/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-cyan-400/90 mb-2">Product</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-10">
            See Robin in action
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/40 overflow-hidden shadow-xl">
              <div className="aspect-video bg-slate-800 flex items-center justify-center border-b border-slate-700/80">
                <div className="text-center p-4">
                  <div className="w-16 h-16 rounded-xl bg-cyan-500/20 border border-cyan-400/30 mx-auto mb-2 flex items-center justify-center text-cyan-400 text-2xl">→</div>
                  <span className="text-xs text-slate-500">Founder flow</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-slate-200">Submit via link</p>
                <p className="text-xs text-slate-500 mt-1">Founder pastes deck → interactive simulation in your voice.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/40 overflow-hidden shadow-xl">
              <div className="aspect-video bg-slate-800 flex items-center justify-center border-b border-slate-700/80">
                <div className="text-center p-4">
                  <div className="w-16 h-16 rounded-xl bg-emerald-500/20 border border-emerald-400/30 mx-auto mb-2 flex items-center justify-center text-emerald-400 text-2xl">◉</div>
                  <span className="text-xs text-slate-500">Belief Map</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-slate-200">VC dashboard</p>
                <p className="text-xs text-slate-500 mt-1">Belief Map + one-click triage (Meet / Refer / Pass).</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/40 overflow-hidden shadow-xl">
              <div className="aspect-video bg-slate-800 flex items-center justify-center border-b border-slate-700/80">
                <div className="text-center p-4">
                  <div className="w-16 h-16 rounded-xl bg-amber-500/20 border border-amber-400/30 mx-auto mb-2 flex items-center justify-center text-amber-400 text-2xl">!</div>
                  <span className="text-xs text-slate-500">Conflict Report</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-slate-200">Transcript upload</p>
                <p className="text-xs text-slate-500 mt-1">Drop transcript → Conflict Report + GRUE checklist + next-call script.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Post-meeting edge */}
      <section className="py-16 sm:py-20 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Post-meeting</p>
          <h2 className="text-2xl font-semibold text-slate-100 mb-4">
            Don&apos;t just take notes. Stress-test the truth.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            After the call, drop the transcript into Robin. Blind spots and evidence gaps you might have missed:
          </p>
          <ul className="space-y-3 text-slate-400 text-sm">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span><strong className="text-slate-300">Conflict Report</strong>: where did claims contradict the data?</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span><strong className="text-slate-300">GRUE Checklist</strong>: Growth, Retention, Unit economics, Execution.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span><strong className="text-slate-300">Next-call script</strong>: the 3 toughest questions for the second partner meeting.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Why Robin vs ChatGPT */}
      <section className="py-16 sm:py-20 border-t border-slate-800/60 bg-slate-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-slate-100 mb-6">Why Robin vs. ChatGPT</h2>
          <blockquote className="pl-4 border-l-4 border-cyan-500/60 text-slate-300 text-base leading-relaxed mb-6">
            &quot;ChatGPT is a generalist. Robin is a specialist built for the VC stack.&quot;
          </blockquote>
          <ul className="space-y-3 text-slate-400 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-0.5">✓</span>
              <span><strong className="text-slate-300">Stateful</strong>: remembers your pipeline and Pass reasons; gets smarter over time.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-0.5">✓</span>
              <span><strong className="text-slate-300">Evidence-first</strong>: cross-references claims against your fund&apos;s risk tolerance.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-400 mt-0.5">✓</span>
              <span><strong className="text-slate-300">Native</strong>: Markdown for Notion, one-click briefs for Slack, Calendar integration.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4">Pricing</h2>
          <p className="text-sm text-slate-400 mb-8">Save 15+ hours/week on triage. At $99/mo, that&apos;s strong ROI for any scout or solo GP.</p>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-700/80 bg-slate-800/30">
              <h3 className="font-semibold text-slate-100">Free</h3>
              <p className="mt-1 text-2xl font-bold text-slate-50">$0</p>
              <p className="mt-3 text-sm text-slate-500">5 stress-tests/month. Perfect for solo scouts.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Pitch link</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Belief Map</li>
                <li className="flex items-center gap-2"><span className="text-slate-600">•</span> Unlimited triage</li>
                <li className="flex items-center gap-2"><span className="text-slate-600">•</span> Calendly logic</li>
              </ul>
              <Link href="/auth" className="mt-6 btn-secondary w-full block text-center">Get started</Link>
            </div>
            <div className="relative p-6 rounded-2xl border-2 border-cyan-500/50 bg-cyan-500/5 shadow-lg shadow-cyan-500/10">
              <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Popular</span>
              <h3 className="font-semibold text-slate-100">Solo</h3>
              <p className="mt-1 text-2xl font-bold text-cyan-400">$99<span className="text-sm font-normal text-slate-400">/mo</span></p>
              <p className="mt-3 text-sm text-slate-400">Unlimited triage, full pipeline, Calendly logic.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Everything in Free</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Unlimited stress-tests</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Pipeline management</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Calendly integration</li>
              </ul>
              <Link href="/auth" className="mt-6 btn-primary w-full block text-center">Start free trial</Link>
            </div>
            <div className="p-6 rounded-2xl border border-slate-700/80 bg-slate-800/30">
              <h3 className="font-semibold text-slate-100">Fund</h3>
              <p className="mt-1 text-xl font-semibold text-slate-400">Custom</p>
              <p className="mt-3 text-sm text-slate-500">Shared deal-flow, team Bar syncing, white-labeled links.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Everything in Solo</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Team intelligence</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> White-label</li>
              </ul>
              <a href="mailto:hello@pitchrobin.work" className="mt-6 btn-secondary w-full block text-center">Contact sales</a>
            </div>
          </div>
          <div className="mt-12">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Common questions</h3>
            <FAQAccordion />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-slate-400 text-sm mb-4">Your calendar should be a moat, not a bottleneck.</p>
              <Link href="/auth" className="btn-primary px-8 py-3">
                Start Filtering Today
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <Link href="/#how-it-works" className="text-slate-400 hover:text-cyan-400 transition-colors">Features</Link>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-cyan-400 transition-colors">Twitter</a>
              <Link href="/terms.html" className="text-slate-400 hover:text-cyan-400 transition-colors">Terms</Link>
              <Link href="/privacy.html" className="text-slate-400 hover:text-cyan-400 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
