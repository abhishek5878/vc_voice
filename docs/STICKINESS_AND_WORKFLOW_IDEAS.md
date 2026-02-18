# Robin.ai — Stickiness & Workflow Ideation

**Goal:** Make Robin feel like an invisible layer over the VC’s existing day (email, calendar, browser), and make the payoff so clear that skipping it feels like flying blind.

---

## 1. Reduce Friction (Fewer Clicks, Less Thinking)

### 1.1 **“Robin ran while you were in the call”**
- **Idea:** Optional background run. User pastes transcript URL or enables “watch clipboard” before the meeting; when they copy the transcript after the call, Robin auto-starts (or shows “Ready to run — paste just happened” one-click).
- **Stickiness:** No “I’ll do it later”; the moment they copy the transcript, Robin is already one click away with context.

### 1.2 **Default to last mode + last company**
- **Idea:** If they used Mode 1 yesterday for “Acme – Series A”, next time they open `/app` prefill: Mode 1, company “Acme”, meeting title from last run. One “Run” for the next meeting with the same company.
- **Stickiness:** Repeats the same motion; no re-typing.

### 1.3 **URL = Run**
- **Idea:** Support `/app?run=1` with optional `&url=https://...` (Notion/Substack/Google Doc). On load: fetch URL into Pitch Material, show “Fetched. Run Robin?” with a single button.
- **Stickiness:** Shareable “run this deck” links; partner sends “run this” and the recipient is one click from the report.

### 1.4 **Browser extension or bookmarklet**
- **Idea:** “Send to Robin” on any page: current page URL or selected text sent to Robin (e.g. prefill Pitch or Transcript). No tab switch to copy-paste.
- **Stickiness:** Robin lives in the same tab as their workflow (Notion, email, calendar).

### 1.5 **Progress that teaches**
- **Idea:** During “Usually 30–60 sec”, show one short tip per step: “Layer 1: Finding claims and tying them to quotes,” “Layer 2: Comparing what they said vs your notes.” Reduces “what’s it doing?” and builds trust in evidence-anchored output.
- **Stickiness:** They understand why the report looks the way it does; more likely to rely on it.

---

## 2. Anchor to Their Tools (Calendar, Email, Slack)

### 2.1 **Calendar as trigger**
- **Idea:** “Tomorrow you have 3 meetings. Robin can prep briefs for: [Acme], [Betalab], [Gamma].” User pastes deck links or “I’ll paste before”; Robin queues or reminds. Optional: read-only calendar connection (OAuth) to show “meetings this week” and attach briefs to event descriptions via “Update event” (already started with Copy & open event).
- **Stickiness:** Robin becomes part of “review my day” instead of a separate tool.

### 2.2 **Email: “Reply with Robin”**
- **Idea:** One-click “Draft reply” from report: not just follow-up email, but “Reply to founder” template: “Thanks for the deck. Before we meet, can you clarify [first red-list question] and share [one GRUE blind spot]?” Prefilled from the report; user adds recipient and sends.
- **Stickiness:** The next step after the report is already in their inbox.

### 2.3 **Slack: “Post to #deal-room”**
- **Idea:** “Copy for Slack” could become “Copy for #deal-room” if we support a saved Slack channel (or webhook). One click posts: meeting name, company, red list bullets, “Full brief in Robin.” Partner sees it without opening Robin.
- **Stickiness:** Robin feeds the channel they already use for deal discussion.

### 2.4 **Notion / Coda: “Add to deal doc”**
- **Idea:** “Copy markdown” is already Notion-ready. Add: “Open in Notion” (Notion API or “Copy + open Notion” with template link). Or “Add to deal doc” that appends the brief to a Notion page via API if user connects workspace.
- **Stickiness:** Brief lives in the same deal doc they already update.

---

## 3. Make the Payoff Obvious (Evidence, Trust, Override)

### 3.1 **“Why this is red” in one line**
- **Idea:** On every red-list item, show a single sentence: “Red because: [why_existential or source_finding].” Optional toggle “Show reasoning” for partners who want to interrogate Robin’s logic.
- **Stickiness:** They can defend or override with a clear reason; builds trust.

### 3.2 **Confidence on every claim**
- **Idea:** You already highlight Unverified (amber). Add a small “Low / Medium / High” or “Needs follow-up” on each Evidence Map claim based on quote strength or conflict. Surfaces “interrogate this” without reading the whole report.
- **Stickiness:** Aligns with VC instinct to dig where it’s fuzzy.

### 3.3 **“Same founder, different claims”**
- **Idea:** If you ever persist runs by company/founder (e.g. in Supabase), show: “Last time they said X about burn; this transcript says Y.” One line in the report or in a “Deal history” sidebar.
- **Stickiness:** Catches narrative drift across meetings; unique to a tool that remembers.

### 3.4 **Override and “Robin was wrong”**
- **Idea:** Let VC mark: “Approve despite red” or “This red is wrong.” Store override + short reason. Use it to (a) show “You overrode 2 items last week” in a lightweight digest, and (b) optionally tune “harshness” from overrides over time.
- **Stickiness:** They feel in control; product learns their bar.

---

## 4. Habit and Triggers

### 4.1 **Daily digest (email or in-app)**
- **Idea:** “Yesterday you ran 2 post-meetings (Acme, Betalab) and 1 prep (Gamma). Red-list summary: [3 bullets]. Open Robin →.” Keeps Robin top-of-mind without being noisy.
- **Stickiness:** Recurring touchpoint.

### 4.2 **Bookmark reminders**
- **Idea:** When they hit “Copy for calendar” or “Copy & open event,” show: “Tip: Bookmark /app?mode=1 for post-call and /app?mode=2 for prep.” Once per device. Reinforces the two moments.
- **Stickiness:** Converts one-time use into a habit (same URL every time).

### 4.3 **“Next meeting” nudge**
- **Idea:** If calendar event link is present and the meeting is in the next 24h, on report show: “Acme – Partner call is tomorrow. Add this brief to the event?” (Copy & open event). Reduces “I’ll do it later.”
- **Stickiness:** Time-bound CTA.

---

## 5. Founder Side (Mode 3) — More Stick

### 5.1 **Founder gets a takeaway**
- **Idea:** At end of Founder Chat: “Copy your 3 action items” (generated from the conversation: e.g. “Clarify burn rate,” “Add slide on retention,” “Rewrite problem statement”). Founder leaves with a checklist, not just a chat log.
- **Stickiness:** Founders reuse the link and tell other founders (“run your deck through this”).

### 5.2 **“Send to my VC”**
- **Idea:** Founder clicks “Send summary to my VC” → prefilled email with “Vibe check” 3-bullet summary (you have “Copy for my Partner”) + optional “Full chat available at [link].” VC gets a digest without opening Robin.
- **Stickiness:** Robin becomes the handoff between founder and VC.

### 5.3 **Founder link with deck pre-attached**
- **Idea:** VC creates link: `/app?mode=3&pitch=https://notion.so/...`. Founder opens; pitch is already loaded. “Your deck is loaded. Start stress-test.”
- **Stickiness:** Zero friction for the founder; VC controls context.

---

## 6. Technical Enablers (Without Full Integrations)

### 6.1 **Granola / Zoom transcript one-click**
- **Idea:** “Paste Granola transcript URL” or “Paste Zoom transcript export URL.” Robin fetches (like fetch-url), parses speaker + timestamps, drops into Public Transcript. One field instead of copy-paste from another tab.
- **Stickiness:** Removes the biggest paste friction for post-call.

### 6.2 **Save “templates” (per user)**
- **Idea:** “Save this run as template: Post-Series-A.” Next time: “Use template: Post-Series-A” prefills meeting title pattern, company placeholder, and maybe system prompt variant (e.g. harsher for Series A). Stored in localStorage or Supabase.
- **Stickiness:** Different workflows (first meeting vs follow-up) without re-configuring.

### 6.3 **Offline / PWA**
- **Idea:** Basic PWA: app shell and input form work offline; “Run when back online.” Or “Export report as PDF” so they can read it on a flight.
- **Stickiness:** Usable in low-connectivity (travel, spotty WiFi).

---

## 7. Prioritized “Next 5” (If You Ship One at a Time)

| # | Idea | Why first | Effort (rough) |
|---|------|-----------|----------------|
| 1 | **Progress that teaches** (1 line per layer on progress screen) | Builds trust during wait; no new integrations | Low |
| 2 | **“Why this is red”** (one line under each red item) | Already have `why_existential`; just surface it | Low |
| 3 | **URL = Run** (`/app?run=1&url=...`) | Shareable “run this deck”; one click to report | Medium |
| 4 | **Reply-to-founder email template** (from report) | Natural next step after report; mailto | Low |
| 5 | **Founder “Copy your 3 action items”** (Mode 3) | Founder takeaway; word of mouth | Medium |

---

## 8. What “Stick” Means Here

- **Stick:** VC opens Robin in the same moments every time (after call, before call, when sharing with founder) and misses it when they skip (FOMO on red list / conflicts / GRUE).
- **Work:** Every run ends in a clear next action (calendar, email, Slack, or “copy for partner”) with minimal extra steps.

The more Robin lives **inside** their existing tools (calendar link, email draft, Slack paste, Notion paste) and **reduces** decisions (“last run prefilled,” “same mode as yesterday,” “one-click run from URL”), the stickier and more useful it becomes.
