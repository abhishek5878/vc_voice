import Link from "next/link";

export const metadata = {
  title: "Robin.ai – Your calendar, filtered.",
  description:
    "Screen inbound founder requests and stress-test meeting transcripts. Built for solo GPs and small-fund partners.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-[680px] mx-auto px-4 py-10">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">Robin.ai</h1>
          <p className="text-lg text-zinc-200 leading-relaxed mb-1">
            Screen inbound founder requests so only high-signal conversations reach your calendar—without you writing a
            single screening email.
          </p>
          <p className="text-zinc-500 text-[0.9375rem]">
            Built for solo GPs and small-fund partners who don&apos;t have a team to filter for them.
          </p>
          <div className="flex flex-wrap gap-3 mt-6 mb-8">
            <Link
              href="/app"
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium text-zinc-950 transition-colors"
            >
              Open Robin
            </Link>
            <Link
              href="/auth.html"
              className="px-6 py-3 rounded-lg border border-amber-500/60 text-amber-500/90 hover:bg-amber-500/10 font-medium transition-colors"
            >
              Sign up / Log in
            </Link>
          </div>
        </header>

        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Two moments</p>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">
          Request → Triage. Meeting done → Stress-test.
        </h2>
        <div className="grid gap-4 mb-8">
          <div className="p-5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <span className="text-xs font-mono text-amber-500/90 block mb-1">Meeting request</span>
            <p className="text-zinc-400 text-[0.9375rem] leading-relaxed">
              Inbound wants a meeting. Robin runs a short, skeptical conversation: extracts signals, checks
              authenticity, and recommends <strong className="text-zinc-300">meet</strong>,{" "}
              <strong className="text-zinc-300">refer out</strong>, or <strong className="text-zinc-300">pass</strong>
              . You get a pipeline and one place to override. The system says no so you don&apos;t have to.
            </p>
          </div>
          <div className="p-5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <span className="text-xs font-mono text-amber-500/90 block mb-1">Post-meeting</span>
            <p className="text-zinc-400 text-[0.9375rem] leading-relaxed">
              You have a transcript (and optionally your notes). Robin stress-tests it: evidence map (claim + source),
              conflict report (transcript vs your notes), blind spots, GRUE-style checklist. So you see what held
              up—and what didn&apos;t—before the next call.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-200 mb-3">What you get</h2>
          <ul className="space-y-2 text-zinc-400 text-[0.9375rem]">
            <li className="pl-5 relative before:absolute before:left-0 before:content-['—'] before:text-amber-500/80">
              Fewer bad meetings. Your calendar becomes the moat, not the bottleneck.
            </li>
            <li className="pl-5 relative before:absolute before:left-0 before:content-['—'] before:text-amber-500/80">
              One workflow: triage state, pipeline, overrides, and post-meeting analysis in one place.
            </li>
            <li className="pl-5 relative before:absolute before:left-0 before:content-['—'] before:text-amber-500/80">
              Your bar, not a generic chatbot. Robin uses your thesis and config (harshness, turn count, rejection
              message).
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/60 border-l-4 border-zinc-700 mb-8">
          <p className="text-zinc-400 text-sm leading-relaxed">
            <strong className="text-zinc-300">Why not just use ChatGPT?</strong> ChatGPT doesn&apos;t know your bar or
            your pipeline. Robin is wired to your workspace: structured triage, evidence-backed recommendations, and a
            stateful workflow your team can act on. The filter sits in how you work.
          </p>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-200 mb-3">Pricing</h2>
          <table className="w-full border-collapse mt-3">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2.5 text-zinc-500 font-medium text-[0.9375rem]">Plan</th>
                <th className="text-left py-2.5 text-zinc-500 font-medium text-[0.9375rem]">Price</th>
                <th className="text-left py-2.5 text-zinc-500 font-medium text-[0.9375rem]">Includes</th>
              </tr>
            </thead>
            <tbody className="text-[0.9375rem]">
              <tr className="border-b border-zinc-800">
                <td className="py-2.5 text-zinc-300">Free</td>
                <td className="py-2.5 font-mono text-amber-500/90">$0</td>
                <td className="py-2.5 text-zinc-400">5 stress-tests/month, unlimited triage, BYOK</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2.5 text-zinc-300">Solo</td>
                <td className="py-2.5 font-mono text-amber-500/90">$199/mo</td>
                <td className="py-2.5 text-zinc-400">Unlimited stress-tests, BYOK, Calendly, pipeline</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2.5 text-zinc-300">Partner / Fund / Enterprise</td>
                <td className="py-2.5 text-zinc-400">—</td>
                <td className="py-2.5 text-zinc-400">Contact us for invoice or PO</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/app"
            className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium text-zinc-950 transition-colors"
          >
            Open Robin
          </Link>
          <Link
            href="/auth.html"
            className="px-6 py-3 rounded-lg border border-amber-500/60 text-amber-500/90 hover:bg-amber-500/10 font-medium transition-colors"
          >
            Sign up
          </Link>
        </div>

        <div className="text-xs text-zinc-500">
          <Link href="/terms.html" className="text-zinc-400 hover:text-amber-500/80">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy.html" className="text-zinc-400 hover:text-amber-500/80">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
