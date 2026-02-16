# Chat endpoint: bulk text → Immediate Appraisal

To have the **chat** endpoint accept bulk text (Granola/Wispr) and return a structured **Immediate Appraisal** instead of a chat reply:

## Option A: Query parameter

In `app/api/v1/endpoints/chat.py`, when handling `POST /{tenant_slug}/chat`:

1. If the request includes `?bulk=1` or a body field `"bulk": true`, treat the `message` as bulk intake text.
2. Call `distill(body.message, api_key=..., persona_name=..., tool_hint=body.tool_hint)`.
3. Return a response that includes:
   - `immediate_appraisal`: from `result["immediate_appraisal"]`
   - `evidence_log`, `blind_spots`, `questions_for_next_meeting`, `source_metadata`
   - Optionally set `evaluation_complete: true` and omit the usual chat `message` so the client can render the appraisal.

Example response shape for bulk:

```json
{
  "message": "",
  "bulk_appraisal": true,
  "immediate_appraisal": { "hook": "...", "signal_count": 3, "verified_count": 2, "blind_spots": ["retention"], "questions_for_next_meeting": ["..."] },
  "evidence_log": [...],
  "blind_spots": ["retention", "cac"],
  "questions_for_next_meeting": ["What's your D90 retention?"],
  "source_metadata": { "source_type": "transcript", "tool": "granola" }
}
```

## Option B: Separate endpoint (current)

Clients can call **`POST /api/v1/{tenant_slug}/intake/bulk`** with `{ "text", "tool_hint", "conversation_id?" }` and get the same structured appraisal without touching the chat flow. Use this when the client has a dedicated "Paste note" or "Upload transcript" action.

## Storing on Lead

When `conversation_id` is sent with the bulk intake request, the Lead (if found or if `create_lead_if_missing: true`) is updated with `source_metadata` and `blind_spots`. The chat endpoint does not need to write these unless you merge bulk into the same conversation; then either call the bulk endpoint first with that `conversation_id`, or in chat after receiving a long message call `distill` and set `lead.source_metadata` / `lead.blind_spots` before replying.
