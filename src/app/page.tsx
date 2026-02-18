import Link from "next/link";

export const metadata = {
  title: "Robin.ai – Your calendar, filtered.",
  description:
    "Screen inbound founder requests and stress-test meeting transcripts. Built for solo GPs and small-fund partners.",
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
            <Link href="/app?mode=3" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
              For founders
            </Link>
            <Link href="/app" className="btn-primary text-sm">
              Open Robin
            </Link>
            <Link href="/auth" className="btn-secondary text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-mesh relative pt-16 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-amber-400/90 text-sm font-medium uppercase tracking-widest mb-4">
            Your calendar, filtered.
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-100 mb-5 leading-[1.15]">
            Screen inbound requests. Stress-test meetings. One workflow.
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Robin runs skeptical conversations with founders, extracts signals, and recommends meet, refer, or pass—so you get a pipeline and one place to override. No screening emails.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="btn-primary px-6 py-3 text-base">
              Open Robin
            </Link>
            <Link href="/auth" className="btn-secondary px-6 py-3 text-base">
              Sign up free
            </Link>
          </div>
        </div>
      </section>

      {/* Two moments */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Two moments</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-10">
            Request → Triage. Meeting done → Stress-test.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="card-hover p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <span className="inline-block text-xs font-mono text-amber-500/90 mb-3">Meeting request</span>
              <p className="text-zinc-400 text-[0.9375rem] leading-relaxed">
                Inbound wants a meeting. Robin runs a short, skeptical conversation: extracts signals, checks
                authenticity, and recommends <strong className="text-zinc-300">meet</strong>,{" "}
                <strong className="text-zinc-300">refer out</strong>, or <strong className="text-zinc-300">pass</strong>.
                You get a pipeline and one place to override.
              </p>
            </div>
            <div className="card-hover p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <span className="inline-block text-xs font-mono text-amber-500/90 mb-3">Post-meeting</span>
              <p className="text-zinc-400 text-[0.9375rem] leading-relaxed">
                You have a transcript (and optionally your notes). Robin stress-tests it: evidence map, conflict report,
                blind spots, GRUE-style checklist. See what held up—and what didn&apos;t—before the next call.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Founders — Lennybot / Mean VC style: one clear entry */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60 bg-gradient-to-b from-amber-500/5 to-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-amber-500/90 mb-2">For founders</p>
          <h2 className="text-2xl font-semibold text-zinc-200 mb-3">
            Stress-test your pitch before the real meeting
          </h2>
          <p className="text-zinc-400 text-[0.9375rem] max-w-2xl mb-8">
            Paste your deck or one-liner. Get interrogated by a blunt, skeptical VC—short answers, real numbers, no fluff. 
            The kind of pushback that makes your pitch stronger. Used by founders prepping for partner meetings and fundraising.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-xs font-mono text-amber-500/90">1</span>
              <p className="text-sm text-zinc-300 mt-1">Paste your deck or pitch</p>
              <p className="text-xs text-zinc-500 mt-0.5">PDF, doc, or raw text. No signup required.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-xs font-mono text-amber-500/90">2</span>
              <p className="text-sm text-zinc-300 mt-1">Get interrogated</p>
              <p className="text-xs text-zinc-500 mt-0.5">Blunt questions. Demand for specifics. Concrete rewrites.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-xs font-mono text-amber-500/90">3</span>
              <p className="text-sm text-zinc-300 mt-1">Tighten before the call</p>
              <p className="text-xs text-zinc-500 mt-0.5">Walk in ready for the hard questions.</p>
            </div>
          </div>
          <Link
            href="/app?mode=3"
            className="btn-primary inline-flex px-6 py-3 text-base"
          >
            Start stress-test →
          </Link>
        </div>
      </section>

      {/* What you get */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-zinc-200 mb-8">What you get</h2>
          <ul className="space-y-4">
            {[
              "Fewer bad meetings. Your calendar becomes the moat, not the bottleneck.",
              "One workflow: triage state, pipeline, overrides, and post-meeting analysis in one place.",
              "Your bar, not a generic chatbot. Robin uses your thesis and config (harshness, turn count, rejection message).",
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-3 text-zinc-400 text-[0.9375rem]">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why not ChatGPT */}
      <section className="py-16 sm:py-20 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 border-l-4 border-l-amber-500/60">
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              <strong className="text-zinc-200">Why not just use ChatGPT?</strong> ChatGPT doesn&apos;t know your bar or
              your pipeline. Robin is wired to your workspace: structured triage, evidence-backed recommendations, and a
              stateful workflow your team can act on. The filter sits in how you work.
            </p>
          </div>
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
              <p className="mt-3 text-sm text-zinc-500">5 stress-tests/month, unlimited triage, BYOK</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 relative">
              <span className="absolute top-4 right-4 text-[10px] font-medium uppercase tracking-wider text-amber-500/90">Popular</span>
              <h3 className="font-semibold text-zinc-100">Solo</h3>
              <p className="mt-1 text-2xl font-semibold text-amber-500">$199/mo</p>
              <p className="mt-3 text-sm text-zinc-400">Unlimited stress-tests, BYOK, Calendly, pipeline</p>
            </div>
            <div className="card-hover p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <h3 className="font-semibold text-zinc-100">Partner / Fund</h3>
              <p className="mt-1 text-lg font-medium text-zinc-500">Custom</p>
              <p className="mt-3 text-sm text-zinc-500">Contact us for invoice or PO</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA + Footer */}
      <footer className="py-12 sm:py-16 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="btn-primary px-6 py-3">
              Open Robin
            </Link>
            <Link href="/auth" className="btn-secondary px-6 py-3">
              Sign up
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
