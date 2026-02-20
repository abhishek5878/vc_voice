"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { StreamContext } from "@/lib/ingest/types";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT = `
You are the VC's direct proxy—a high-tier associate who thinks and speaks as they would. Skeptical, data-driven, concise. You never say "I am an AI" or break the fiction that you are the investor's digital twin.

Core behavior — hunt for "Belief Collapse":
- When a founder makes any claim (e.g. "Our CAC is $5", "40% MoM growth"), immediately ask for supporting evidence or the underlying assumption. No free passes.
- Reference the investor's actual thesis when relevant: "In [Investor Name]'s recent memo on [topic], they prioritized X. How do you reconcile that with your current GTM?"
- Short answers. Real numbers. No fluff. If they're vague, one chance then: "That's not an answer." or "Try again with actual numbers."

Goals (in order):
1) Stress-test: Problem, Solution, Market, Competition, Traction, Team, Moat, Unit economics, Ask.
2) Force evidence. Every claim gets probed: source, assumption, or data.
3) End each turn with a clear next action or one sharp question.

Tone: Professional but skeptical. Never cruel; always sharp. Speak as the VC would in a partner meeting—no sugarcoating.

Hard rules:
- Never say you are an AI, a bot, or a language model. You are [Investor Name]'s proxy.
- Use DECK_TEXT. If you need more, ask for specific slides or sections.
- Keep responses short, high-signal, and actionable.
`.trim();

const VIBE_CHECK_SYSTEM = `
You are summarizing a founder pitch stress-test chat for a VC partner. Output exactly 3 short bullets, no intro or outro:
1) Vibe: one line on how the founder came across (e.g. prepared vs defensive, numbers vs fluff).
2) Strengths: one line on what was strongest (e.g. clarity on TAM, crisp unit economics).
3) Concerns: one line on what to probe (e.g. competition hand-waved, traction unverified).
Keep each bullet under 100 characters. Plain text only, no markdown.
`.trim();

const ACTION_ITEMS_SYSTEM = `
You are summarizing a founder pitch stress-test conversation into 3 concrete action items for the founder. Output exactly 3 bullets, no intro or outro. Each line should be a clear next step they can do (e.g. "Clarify burn rate with a number and runway date", "Add a slide on retention cohorts", "Rewrite the problem statement in one sentence"). Plain text only, no markdown. Number them 1. 2. 3.
`.trim();

interface SendToInvestorResult {
  pointers: string;
  at_par: boolean;
  vc_email?: string;
  emailSubject?: string;
  emailBody?: string;
}

export default function FounderChat({
  initialStreamContext,
  voiceProfile,
  onBack,
  onToast,
  shareablePitchLink,
  slug,
  investorDisplayName,
  companyName,
  submitted,
  singleColumnLayout = false,
}: {
  initialStreamContext: StreamContext;
  voiceProfile?: string | null;
  onBack: () => void;
  onToast?: (message: string) => void;
  /** When on a VC pitch page, pass the full URL so "Copy link" shares that instead of /app?mode=3 */
  shareablePitchLink?: string | null;
  /** VC slug for "Send to [investor]" */
  slug?: string | null;
  investorDisplayName?: string | null;
  companyName?: string;
  /** When true (e.g. after founder submitted pitch), auto-fetch pointers and show prominently */
  submitted?: boolean;
  /** When true (e.g. on VC pitch page), single column: chat only, no deck sidebar; better for founders */
  singleColumnLayout?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vibeCheckLoading, setVibeCheckLoading] = useState(false);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const [actionItemsCopied, setActionItemsCopied] = useState(false);
  const [vibeCheckCopied, setVibeCheckCopied] = useState(false);
  const [sendToInvestorLoading, setSendToInvestorLoading] = useState(false);
  const [sendToInvestorResult, setSendToInvestorResult] = useState<SendToInvestorResult | null>(null);
  const [convictionScore, setConvictionScore] = useState<number | null>(null);
  const [messageSignals, setMessageSignals] = useState<Record<number, "narrative_collapse" | "needs_evidence" | "strong_signal">>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFetchedPointers = useRef(false);

  const deckText =
    initialStreamContext.PITCH_MATERIAL ||
    initialStreamContext.PUBLIC_TRANSCRIPT ||
    initialStreamContext.PRIVATE_DICTATION ||
    "";
  const hasDeck = deckText.trim().length > 0;
  const hasInvestorVoice = Boolean(voiceProfile?.trim());

  const investorShortName =
    typeof investorDisplayName === "string"
      ? investorDisplayName.split(/[,·]| at /)[0]?.trim() || investorDisplayName
      : "the investor";
  const initialGreeting =
    hasInvestorVoice && investorDisplayName
      ? `I've analyzed ${investorShortName}'s thesis and your deck. You're making claims about growth and burn—before I submit this to the pipeline, walk me through the unit economics: how does this scale if your primary channel saturates? Be direct. (Or in one or two sentences: what are you building, and what do you want from this session?)`
      : "I've read your deck. Short answers, real numbers, no fluff. Walk me through the unit economics—how does this scale if your primary channel saturates? Be direct. (Or in one or two sentences: what are you building, and what do you want from this session?)";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Seed an initial assistant message once when we have deck text.
  useEffect(() => {
    if (!deckText.trim()) return;
    if (messages.length > 0) return;
    setMessages([{ role: "assistant", content: initialGreeting }]);
  }, [deckText, messages.length, initialGreeting]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      const persona =
        voiceProfile?.trim()
          ? `You ARE this investor. Every reply must sound like them: their wording, their skepticism, their pet phrases. Do not fall back to generic VC tone. Adopt their sentence structure and the questions they typically ask.\n\nInvestor voice profile:\n${voiceProfile.trim()}\n\n---\n\n`
          : "";
      const systemWithDeck =
        persona +
        SYSTEM_PROMPT +
        "\n\nDECK_TEXT (pitch deck content):\n" +
        deckText.slice(0, 20000);

      const res = await fetch("/api/llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: systemWithDeck },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          stream: false,
        }),
      });

      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response from LLM" : `Server error (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data.detail || data.error || `Chat failed (${res.status})`);
      }

      const reply = (data.content ?? "").trim();
      if (!reply) {
        throw new Error("Empty response from LLM");
      }

      const nextMessagesWithReply: ChatMessage[] = [...nextMessages, { role: "assistant", content: reply }];
      setMessages(nextMessagesWithReply);

      // Update conviction bar and heat map (fire-and-forget).
      fetch("/api/chat/conviction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessagesWithReply.map((m) => ({ role: m.role, content: m.content })),
          deckText: deckText.slice(0, 8000),
        }),
      })
        .then((r) => r.json())
        .then((data: { confidence_score?: number; message_signals?: { message_index: number; signal: string }[] }) => {
          if (typeof data.confidence_score === "number") {
            setConvictionScore(Math.max(0, Math.min(100, data.confidence_score)));
          }
          if (Array.isArray(data.message_signals)) {
            const sigs: Record<number, "narrative_collapse" | "needs_evidence" | "strong_signal"> = {};
            data.message_signals.forEach((s) => {
              if (["narrative_collapse", "needs_evidence", "strong_signal"].includes(s.signal)) {
                sigs[s.message_index] = s.signal as "narrative_collapse" | "needs_evidence" | "strong_signal";
              }
            });
            setMessageSignals(sigs);
          }
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }, [deckText, messages, input, loading, voiceProfile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const copyForPartner = useCallback(async () => {
    if (messages.length < 2 || vibeCheckLoading) return;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    setError(null);
    setVibeCheckLoading(true);
    try {
      const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: VIBE_CHECK_SYSTEM },
            ...conversation,
          ],
          stream: false,
        }),
      });
      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.detail || data.error || `Failed (${res.status})`);
      const summary = (data.content ?? "").trim();
      if (!summary) throw new Error("Empty summary");
      await navigator.clipboard.writeText(summary);
      onToast?.("Vibe check copied to clipboard");
      setVibeCheckCopied(true);
      setTimeout(() => setVibeCheckCopied(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Vibe check failed";
      setError(/clipboard|writeText/i.test(msg) ? "Couldn't copy — please try clicking manually." : msg);
    } finally {
      setVibeCheckLoading(false);
      if (typeof window !== "undefined") requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  }, [messages, vibeCheckLoading, onToast]);

  const copyActionItems = useCallback(async () => {
    if (messages.length < 2 || actionItemsLoading) return;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    setError(null);
    setActionItemsLoading(true);
    try {
      const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: ACTION_ITEMS_SYSTEM },
            ...conversation,
          ],
          stream: false,
        }),
      });
      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.detail || data.error || `Failed (${res.status})`);
      const summary = (data.content ?? "").trim();
      if (!summary) throw new Error("Empty action items");
      await navigator.clipboard.writeText(summary);
      onToast?.("3 action items copied to clipboard");
      setActionItemsCopied(true);
      setTimeout(() => setActionItemsCopied(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action items failed";
      setError(/clipboard|writeText/i.test(msg) ? "Couldn't copy — please try clicking manually." : msg);
    } finally {
      setActionItemsLoading(false);
      if (typeof window !== "undefined") requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  }, [messages, actionItemsLoading, onToast]);

  const handleSendToInvestor = useCallback(async () => {
    if (!slug || messages.length < 2 || sendToInvestorLoading) return;
    setError(null);
    setSendToInvestorResult(null);
    setSendToInvestorLoading(true);
    try {
      const res = await fetch("/api/pitch/send-to-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          companyName: companyName?.trim() || "Unknown",
        }),
      });
      const data = (await res.json()) as SendToInvestorResult & { error?: string; detail?: string };
      if (!res.ok) throw new Error(data.error || data.detail || "Failed");
      setSendToInvestorResult({
        pointers: data.pointers ?? "",
        at_par: Boolean(data.at_par),
        vc_email: data.vc_email,
        emailSubject: data.emailSubject,
        emailBody: data.emailBody,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get pointers");
    } finally {
      setSendToInvestorLoading(false);
    }
  }, [slug, messages, companyName, sendToInvestorLoading]);

  const showSendToInvestor = Boolean(slug && investorDisplayName);

  // After founder submits pitch, auto-fetch pointers once so they get actionable feedback
  useEffect(() => {
    if (
      !submitted ||
      !showSendToInvestor ||
      messages.length < 2 ||
      sendToInvestorResult != null ||
      sendToInvestorLoading ||
      hasAutoFetchedPointers.current
    )
      return;
    hasAutoFetchedPointers.current = true;
    void (async () => {
      setSendToInvestorLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pitch/send-to-investor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            companyName: companyName?.trim() || "Unknown",
          }),
        });
        const data = (await res.json()) as SendToInvestorResult & { error?: string; detail?: string };
        if (!res.ok) throw new Error(data.error || data.detail || "Failed");
        setSendToInvestorResult({
          pointers: data.pointers ?? "",
          at_par: Boolean(data.at_par),
          vc_email: data.vc_email,
          emailSubject: data.emailSubject,
          emailBody: data.emailBody,
        });
      } catch {
        hasAutoFetchedPointers.current = false;
      } finally {
        setSendToInvestorLoading(false);
      }
    })();
  }, [submitted, showSendToInvestor, slug, messages, companyName, sendToInvestorResult, sendToInvestorLoading]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            ← Back to inputs
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {investorDisplayName && slug
                ? `Stress-test with ${investorShortName}`
                : "PitchRobin · Founder Chat"}
            </h1>
            <p className="text-xs text-zinc-500">
              {investorDisplayName && slug ? "Live Q&A in this investor’s style" : "Live VC simulation"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const url =
                shareablePitchLink?.trim() ||
                `${typeof window !== "undefined" ? window.location.origin : ""}/app?mode=3`;
              void navigator.clipboard.writeText(url);
            }}
            className="text-xs text-cyan-500/90 hover:text-cyan-400"
          >
            Copy link for another founder
          </button>
          {messages.length >= 2 && (
            <>
              {showSendToInvestor && (
                <button
                  type="button"
                  onClick={() => void handleSendToInvestor()}
                  disabled={sendToInvestorLoading}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-900 text-xs font-medium border border-cyan-400/50 disabled:opacity-50"
                  title={`Get pointers from ${investorDisplayName} and optionally email them`}
                >
                  {sendToInvestorLoading ? "Generating…" : "Send to investor"}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void copyActionItems();
                }}
                disabled={actionItemsLoading}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs border border-cyan-500/40 disabled:opacity-50"
                title="Your 3 action items from this session"
              >
                {actionItemsCopied ? "Copied!" : actionItemsLoading ? "Generating…" : "Copy your 3 action items"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void copyForPartner();
                }}
                disabled={vibeCheckLoading}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700/50 disabled:opacity-50"
                title="3-bullet vibe check for your partner"
              >
                {vibeCheckCopied ? "Copied!" : vibeCheckLoading ? "Generating…" : "Copy for my Partner"}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 gap-4">
        {hasDeck && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 px-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-xs">
            {companyName?.trim() ? (
              <span className="text-zinc-400">Stress-testing: {companyName}</span>
            ) : null}
            {hasInvestorVoice && (
              <span className="inline-flex items-center gap-1.5 font-medium text-cyan-400/95">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400/90" aria-hidden />
                Speaking in this investor&apos;s voice
              </span>
            )}
          </div>
        )}
        {!hasDeck && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            No pitch material found. Go back and paste or upload your deck first.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-1">
            {error}
          </div>
        )}
        {submitted && sendToInvestorLoading && !sendToInvestorResult && (
          <section className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5">
            <p className="text-sm text-cyan-400/90">Getting your personalized pointers…</p>
          </section>
        )}
        {sendToInvestorResult && (
          <section className="p-5 sm:p-6 rounded-2xl border-2 border-cyan-500/40 bg-cyan-500/10 space-y-4 shadow-lg shadow-cyan-500/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-100">
                {submitted ? "Here’s what to work on before your meeting" : `${investorDisplayName ?? "Investor"}'s pointers for you`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (sendToInvestorResult.pointers) {
                    void navigator.clipboard.writeText(sendToInvestorResult.pointers);
                    onToast?.("Pointers copied to clipboard");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-600"
              >
                Copy pointers
              </button>
            </div>
            <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed space-y-2">
              {(() => {
                const lines = sendToInvestorResult.pointers.split(/\n/).map((l) => l.trim()).filter(Boolean);
                return lines.length > 0
                  ? lines.map((line, i) => (
                      <p key={i} className="flex gap-2">
                        <span className="text-cyan-400/80 shrink-0">•</span>
                        <span>{line}</span>
                      </p>
                    ))
                  : <p>{sendToInvestorResult.pointers}</p>;
              })()}
            </div>
            {sendToInvestorResult.at_par && sendToInvestorResult.vc_email && (
              <div className="pt-3 border-t border-cyan-500/20">
                <p className="text-xs text-zinc-400 mb-2">
                  You’re at par. Email your profile and evidence directly to {investorDisplayName}:
                </p>
                <a
                  href={`mailto:${encodeURIComponent(sendToInvestorResult.vc_email)}?subject=${encodeURIComponent(sendToInvestorResult.emailSubject ?? "")}&body=${encodeURIComponent(sendToInvestorResult.emailBody ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-900 text-sm font-medium"
                >
                  Email my pitch to {investorDisplayName}
                </a>
              </div>
            )}
            {sendToInvestorResult.at_par && !sendToInvestorResult.vc_email && (
              <p className="text-xs text-zinc-500 pt-3 border-t border-cyan-500/20">
                You’re at par. This investor hasn’t set a contact email yet; submit your pitch using the button below to land in their queue.
              </p>
            )}
          </section>
        )}
        <div className={`flex-1 min-h-0 ${singleColumnLayout ? "flex flex-col max-w-3xl mx-auto w-full" : "grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] gap-4"}`}>
          {!singleColumnLayout && (
          <section className="hidden lg:flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-400 overflow-hidden min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Deck snapshot</p>
                <p className="text-[11px] text-zinc-500">
                  {deckText.length.toLocaleString()} chars ·{" "}
                  {Math.max(1, Math.round(deckText.length / 800))} slide-equivalents (rough)
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 rounded-md bg-zinc-950/60 border border-zinc-800/70 p-2 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {deckText ? deckText.slice(0, 3000) : "No deck text available."}
              {deckText.length > 3000 && (
                <span className="block mt-2 text-[10px] text-zinc-600">
                  …truncated. The VC still sees the full deck in context.
                </span>
              )}
            </div>
          </section>
          )}
          <section className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/30 min-h-0 overflow-hidden ${singleColumnLayout ? "flex-1" : ""}`}>
            <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-1 shrink-0">
              <span className="text-sm text-zinc-400">
                Reply below. Enter to send, Shift+Enter for new line.
              </span>
            </div>
            {messages.length >= 2 && (
              <div className="px-4 py-2 border-b border-zinc-800/80 shrink-0" aria-label="Conviction meter">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">Conviction</span>
                  <span className="text-xs font-medium text-zinc-400">{convictionScore != null ? `${Math.round(convictionScore)}%` : "—"}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500/90 via-amber-500/90 to-emerald-500/90 transition-all duration-500"
                    style={{ width: `${convictionScore != null ? Math.max(2, convictionScore) : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div
              ref={scrollRef}
              className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 ${singleColumnLayout ? "min-h-[320px]" : "min-h-[200px]"}`}
            >
              {messages.map((m, idx) => {
                const signal = m.role === "user" ? messageSignals[idx] : undefined;
                const signalBorder =
                  signal === "narrative_collapse"
                    ? "border-l-4 border-red-500"
                    : signal === "needs_evidence"
                      ? "border-l-4 border-amber-500"
                      : signal === "strong_signal"
                        ? "border-l-4 border-emerald-500"
                        : "";
                return (
                <div
                  key={idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[92%] sm:max-w-[85%] flex flex-col space-y-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <span
                      className={`text-xs font-semibold tracking-wide ${
                        m.role === "user" ? "text-cyan-400" : "text-zinc-400"
                      }`}
                    >
                      {m.role === "user" ? "You" : "VC"}
                      {signal && (
                        <span className="ml-1.5 text-[10px] normal-case font-normal opacity-80">
                          {signal === "narrative_collapse" ? "· Narrative collapse" : signal === "needs_evidence" ? "· Needs evidence" : "· Strong signal"}
                        </span>
                      )}
                    </span>
                    <div
                      className={`leading-relaxed rounded-2xl px-4 py-3.5 text-[15px] ${signalBorder} ${
                        m.role === "user"
                          ? "bg-cyan-500 text-zinc-950 whitespace-pre-wrap"
                          : "bg-zinc-800 text-zinc-100 border border-zinc-600/60 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
              {messages.length === 0 && (
                <div className="text-zinc-400 text-[15px] py-4">
                  Reply with your one-line summary, or ask to focus on Problem, Market, Traction, Team, or Moat.
                </div>
              )}
            </div>
            <div className="border-t border-zinc-800 p-4 shrink-0 bg-zinc-900/50">
              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    hasDeck
                      ? "Type your reply…"
                      : "No deck text found. Go back and add your pitch."
                  }
                  rows={singleColumnLayout ? 3 : 2}
                  className="flex-1 min-h-[52px] max-h-40 px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 resize-y"
                  aria-label="Message"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  className="shrink-0 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-[15px] font-semibold text-zinc-950 min-h-[52px]"
                >
                  {loading ? "…" : "Send"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

