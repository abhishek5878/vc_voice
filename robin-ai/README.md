# Robin.ai

Multi-mode intelligence system for high-stakes decision-makers (VCs). Finds the truth in a conversation that participants either couldn't see or didn't want to say.

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** Supabase (Postgres) — schema in `supabase/schema.sql`
- **AI:** BYOK — user supplies OpenAI / Anthropic / Groq API key (session only, never stored)

## Sprint 1 (Done)

- [x] Input ingestion: text paste + PDF (pdf-parse) + DOCX (mammoth)
- [x] SPA 4-layer pipeline with spec prompts and JSON validation
- [x] BYOK proxy: `POST /api/llm`, `POST /api/llm/validate`
- [x] Supabase schema: `founders`, `robin_sessions`, `claims_log`, `pedigree_flags`
- [x] Mode routing: 1 (post-meeting), 2 (pre-meeting prep), 3 (pitch stress-test)

## Sprint 2 (Done)

- [x] Mode select screen (three cards: Post-Meeting, Pre-Meeting Prep, Pitch Stress-Test)
- [x] Input interface: paste + file upload per stream (Public Transcript, Private Dictation, Pitch Material)
- [x] Pipeline progress screen (4 steps with labels)
- [x] Analysis report renderer: Evidence Map, Conflict Report, GRUE Coverage, Conviction Interrogation (Red/Yellow/Pedigree), Pre-Meeting Attack Brief (Mode 2)
- [x] Export: Copy markdown, Download .md

## API

### Ingestion

- **POST /api/ingest**  
  - Body: `multipart/form-data` or JSON with `public_transcript`, `private_dictation`, `pitch_material` (text or file).  
  - Returns: `{ streamContext, present }`.

### Analysis

- **POST /api/analyze**  
  - Headers: `Authorization: Bearer <your-openai-or-anthropic-key>`  
  - Body: `{ streamContext, mode: 1|2|3, provider?: "openai"|"anthropic"|"groq", model? }`  
  - Returns: Full pipeline result (layer_1–4, pre_meeting_attack_brief for mode 2).

### BYOK

- **POST /api/llm**  
  - Headers: `Authorization: Bearer <key>`  
  - Body: `{ provider, model?, messages, stream? }`  
  - Proxies to OpenAI / Anthropic / Groq. Key never logged or stored.

- **POST /api/llm/validate**  
  - Headers: `Authorization: Bearer <key>`  
  - Body: `{ provider?, model? }`  
  - Returns: `{ valid: true }` or 401.

## Env

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# For PDF parsing (POST /api/parse-pdf). Server-side only; not sent from client.
OPENAI_API_KEY=sk-...
```

Run `supabase/schema.sql` in the Supabase SQL editor to create tables.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). UI (mode select, input screen, report renderer) is Sprint 2.
