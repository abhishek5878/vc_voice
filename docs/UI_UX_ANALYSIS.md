# PitchRobin UI/UX Analysis

A structured review of the product’s interface and experience across landing, auth, onboarding, app, and founder-facing flows.

---

## 1. Overview

| Area | What exists |
|------|-------------|
| **Landing** | Hero, value props, “How it works” (3 steps), product cards, post-meeting section, “Why Robin”, pricing (Free/Solo/Fund), FAQ, footer |
| **Auth** | Single passcode (+ optional email); redirects to onboarding |
| **Onboarding** | Social links → slug → optional voice/text → “Build my voice”; manual step if scrape insufficient |
| **App (VC)** | Mode select → Input → Progress → Report or Chat; deals list; settings (profile, voice); pitch link + copy |
| **Pitch page** | Per-VC branded page: hero, “How I evaluate”, PitchIntake (deck + stress-test + submit) |
| **Founder flow** | Paste/upload deck → FounderChat (stress-test in VC voice) → optional submit to VC |

**Users:** VCs (set up voice, get link, triage); founders (land on `/pitch/[slug]`, stress-test, submit).

---

## 2. Strengths

- **Clear value prop on landing:** “Your Investment Bar, Automated” and Belief Map mock make the benefit concrete.
- **Single primary CTA:** “Create Your Pitch Link (Free)” is repeated; pricing clarifies Free vs Solo.
- **Mode select is scannable:** Three cards (Post-Meeting, Pre-Meeting Prep, Pitch Stress-Test) with “Best for” and “Start →”.
- **Pitch page feels owned by the VC:** Hero with “Stress-test your pitch in my voice”, copyable link, “How I evaluate” card.
- **Clipboard detection:** Transcript/link autofill reduces friction for power users.
- **Command palette (⌘K):** Fast mode switch and recent runs.
- **Voice fallback:** When scrape isn’t enough, text + record/upload voice is available (onboarding + settings).
- **Consistent dark theme:** Dark backgrounds and muted text are used throughout.

---

## 3. Consistency & Design System

### 3.1 Palette split

| Surface | Landing | App / Auth / Onboarding / Pitch |
|--------|---------|-----------------------------------|
| Background | `slate-950`, `slate-900` | `zinc-950`, `zinc-900` |
| Borders | `slate-700/80`, `slate-800` | `zinc-700`, `zinc-800` |
| Accent / CTAs | **Cyan** (`cyan-400`, `cyan-500`) | **Amber** (`amber-400`, `amber-500`) |
| Muted text | `slate-400`, `slate-500` | `zinc-400`, `zinc-500` |

- **Effect:** Landing reads as “teal/SaaS”; app reads as “amber/action”. The shift at auth is noticeable.
- **Recommendation:** Either unify on one accent (e.g. cyan everywhere, or amber everywhere) or make the split intentional (e.g. “marketing = cyan, product = amber”) and document it.

### 3.2 CSS variables vs Tailwind

- `globals.css` defines `:root` tokens (`--accent`, `--border`, etc.) but most components use Tailwind (e.g. `bg-cyan-500`, `border-zinc-800`) directly.
- Buttons use `.btn-primary` / `.btn-secondary` (cyan, slate) on landing; app uses ad‑hoc amber buttons.
- **Recommendation:** Use design tokens for accent, surface, and border in one place and reference them in Tailwind (e.g. `bg-[var(--accent)]`) or extend Tailwind theme so one change updates landing and app.

### 3.3 Typography and density

- Geist Sans/Mono in layout; headings are consistently `font-semibold` / `tracking-tight`.
- Inputs and cards mix `rounded-lg` and `rounded-xl` / `rounded-2xl`; generally fine.
- Onboarding and settings use many URL inputs in a single column; feels long. Grouping (e.g. “Social” vs “Other links”) or compact rows could reduce scroll.

---

## 4. User Flows: Friction and Gaps

### 4.1 Landing → Auth → Onboarding

- **Landing:** “Log in” and “Sign up” both go to `/auth`; no distinction. Fine for passcode-only.
- **Auth tagline:** “Your calendar, filtered.” is different from landing (“Investment Bar, Automated”). Small copy inconsistency.
- **Onboarding:** One long form (links + slug + optional voice + submit). No progress indicator. If “Build my voice” fails or returns `insufficient_content`, user sees the manual step; that’s clear.
- **Missing:** No “Skip for now” or “I’ll add links later” so users could get a slug and link first, then add voice. Today they must add at least enough for ingest or manual text.

### 4.2 App (VC dashboard)

- **Mode select vs “Your pitch link”:** When `view === "mode"`, the main content is the pitch link + Copy + Deals/Settings. Mode selection lives in a different view (after “Back to Robin” from input). So the default app view is “here’s your link”, not “choose a mode”. That’s good for the “share link” job; less obvious that “analyze transcript” or “prep” is one click away.
- **Navigation:** Deals and Insights and Settings are in the header when in mode select; when in input/report/chat, back is “← Back to inputs” or “Back to Robin”. No persistent top nav in input/report/chat, so “Deals” / “Settings” require going back first.
- **Recommendation:** Consider a minimal persistent nav (e.g. logo + “Deals” + “Settings”) on all app views so users don’t lose context.

### 4.3 Pitch page (founder)

- **Strong:** Hero, “How I evaluate”, one clear step (add pitch → start stress-test), then chat. Copyable link with “Copy” is clear.
- **Gaps:** No visible “Powered by PitchRobin” or similar in the hero (footer only). No estimate of “this takes ~2–3 min” or “you’ll get 3–5 questions”. Optional: short “What happens next” (e.g. “We’ll ask a few questions in [Name]’s style; then you can submit to their pipeline.”).

### 4.4 FounderChat and report

- **Chat:** Header shows “Stress-test in [Name]’s voice” on pitch page; “PitchRobin · Founder Chat” in app. Good. Actions (Copy action items, Send to investor, Copy for Partner) appear after messages; could be slightly more discoverable (e.g. one line of copy: “After the conversation you can…”).
- **Report:** Dense content (evidence map, conflicts, GRUE, interrogation). Back, duplicate run, “Save to deals” are present; scrolling and hierarchy are acceptable. No obvious “Share report” or “Email brief” in the first glance.

---

## 5. States and Feedback

| State | Handling |
|-------|----------|
| **Loading** | “Building your voice…”, “Loading…”, “Analyzing…” in buttons or inline text. Pipeline has step-based progress. |
| **Error** | Red banner / inline text (e.g. “Incorrect passcode”, “Fetch failed”). Often generic. |
| **Empty** | Deals: “No deals yet. Run an analysis with a company name to create one.” Clear. |
| **Success** | Toasts (“Link copied”, “Deal saved to your history”). Short-lived. |

- **Gaps:** No global “Something went wrong” recovery (e.g. retry or “Back to home”). Form errors don’t always scroll into view. Long-running ingest (5 min scrape) has no progress beyond “Building…” so users may think it’s stuck.

---

## 6. Accessibility and Responsiveness

- **Focus:** Buttons and inputs use `focus:outline-none focus:ring-1` or `focus:ring-2`; generally visible focus.
- **Labels:** Key inputs have `<label htmlFor=...>`. VoiceStyleInput and some sections use `<label>` or heading text.
- **ARIA:** Limited (e.g. `aria-hidden` on decorative gradient). No live regions for toasts or dynamic errors; screen readers may miss “Link copied” or error messages.
- **Responsiveness:** Layouts use `max-w-*`, `flex`, `grid`, and `sm:` breakpoints. Pitch page and onboarding are single column; app mode select is 3 columns on `md`. Mobile: nav and long forms will scroll; no obvious breakage.
- **Contrast:** Dark surfaces with zinc/slate 400/500 text; likely passes WCAG AA for body text. Amber and cyan accents on dark backgrounds should be checked for buttons and links.

---

## 7. Recommendations (Prioritized)

### High impact

1. **Unify or formalize accent palette**  
   Either use one accent (e.g. cyan) across landing and app, or define “marketing vs product” and apply consistently. Update `globals.css` and key components so one token drives CTAs.

2. **Persistent app nav**  
   Add a slim header on input, report, and chat (e.g. PitchRobin logo, Deals, Settings) so users don’t have to go “Back” to reach deals/settings.

3. **Onboarding progress and skip**  
   Add a step indicator (e.g. 1. Links, 2. Slug, 3. Voice) and consider “Get my link first, add voice later” so users can get the shareable link even if they haven’t added links yet.

### Medium impact

4. **Auth and landing copy**  
   Align auth tagline with landing (e.g. “Your investment bar, automated” or “Sign in to PitchRobin”).

5. **Ingest feedback**  
   For “Build my voice” / “Rebuild from links”, show a simple progress state (e.g. “Scraping links… 1/5”) or “This can take up to 5 minutes” so users know it’s not stuck.

6. **Pitch page “What happens next”**  
   One line under the CTA: e.g. “You’ll answer a few questions in my style, then can submit to my pipeline.”

### Polish

7. **Error recovery**  
   On API or network errors, show a “Try again” or “Back to home” so users aren’t stuck.

8. **Toast and errors for screen readers**  
   Use `aria-live="polite"` (or `assertive` for errors) for toast and inline error regions.

9. **Deals empty state**  
   Add a secondary CTA: “Run your first analysis” linking to `/app` or mode 2.

---

## 8. Summary

- **Strengths:** Clear value prop, strong pitch page, good mode selection and clipboard/command-palette flows, and a sensible voice fallback (text + voice).
- **Main issues:** Accent and surface palette differ between landing (slate/cyan) and app (zinc/amber); no persistent app nav; onboarding is one long form with no progress or skip; and loading/error feedback could be clearer.
- Addressing **accent consistency**, **persistent nav**, and **onboarding clarity** will improve perceived polish and ease of use the most.
