/**
 * Input ingestion: build stream context from text paste and/or file uploads.
 * POST /api/ingest
 * Body: multipart/form-data or JSON with text fields and optional file parts.
 * - public_transcript: text or .txt/.md file
 * - private_dictation: text (audio → Whisper in Sprint 4)
 * - pitch_material: text or PDF/DOCX file
 * Returns: { streamContext: { PUBLIC_TRANSCRIPT?, PRIVATE_DICTATION?, PITCH_MATERIAL? }, present: StreamLabel[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { extractPdfText, extractDocxText, truncate, MAX_STREAM_CHARS, MIN_INPUT_CHARS } from "@/lib/ingest/parse";
import type { StreamContext, StreamLabel } from "@/lib/ingest/types";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const streamContext: StreamContext = {};
  const present: StreamLabel[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      const addText = (key: keyof StreamContext, value: string | null) => {
        const t = (value ?? "").trim();
        if (!t) return;
        streamContext[key] = truncate(t, MAX_STREAM_CHARS);
        present.push(key as StreamLabel);
      };

      addText("PUBLIC_TRANSCRIPT", formData.get("public_transcript") as string | null);
      addText("PRIVATE_DICTATION", formData.get("private_dictation") as string | null);
      addText("PITCH_MATERIAL", formData.get("pitch_material") as string | null);

      // File parts
      const pubFile = formData.get("public_transcript_file") as File | null;
      const privFile = formData.get("private_dictation_file") as File | null;
      const pitchFile = formData.get("pitch_material_file") as File | null;

      if (pubFile?.size && !streamContext.PUBLIC_TRANSCRIPT) {
        const out = await fileToTextSafe(pubFile);
        if ("error" in out) {
          return NextResponse.json(
            { error: "Public transcript file could not be read", detail: out.error },
            { status: 400 }
          );
        }
        if (out.text) {
          streamContext.PUBLIC_TRANSCRIPT = truncate(out.text, MAX_STREAM_CHARS);
          present.push("PUBLIC_TRANSCRIPT");
        }
      }
      if (privFile?.size && !streamContext.PRIVATE_DICTATION) {
        const out = await fileToTextSafe(privFile);
        if ("error" in out) {
          return NextResponse.json(
            { error: "Private dictation file could not be read", detail: out.error },
            { status: 400 }
          );
        }
        if (out.text) {
          streamContext.PRIVATE_DICTATION = truncate(out.text, MAX_STREAM_CHARS);
          present.push("PRIVATE_DICTATION");
        }
      }
      if (pitchFile?.size && !streamContext.PITCH_MATERIAL) {
        const out = await fileToTextSafe(pitchFile);
        if ("error" in out) {
          return NextResponse.json(
            { error: "Pitch deck upload failed", detail: out.error },
            { status: 400 }
          );
        }
        if (out.text) {
          streamContext.PITCH_MATERIAL = truncate(out.text, MAX_STREAM_CHARS);
          present.push("PITCH_MATERIAL");
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      const add = (key: keyof StreamContext, v: unknown) => {
        const t = String(v ?? "").trim();
        if (!t) return;
        streamContext[key] = truncate(t, MAX_STREAM_CHARS);
        present.push(key as StreamLabel);
      };
      add("PUBLIC_TRANSCRIPT", body.public_transcript);
      add("PRIVATE_DICTATION", body.private_dictation);
      add("PITCH_MATERIAL", body.pitch_material);
      if (body.pedigree_data) {
        add("PEDIGREE_DATA", body.pedigree_data);
      }
    }

    const totalChars = Object.values(streamContext).reduce((s, v) => s + (v?.length ?? 0), 0);
    if (totalChars < MIN_INPUT_CHARS) {
      return NextResponse.json(
        { error: "Input too short for meaningful analysis. Paste your full transcript or pitch narrative." },
        { status: 400 }
      );
    }
    if (present.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one input: public transcript, private dictation, or pitch material." },
        { status: 400 }
      );
    }

    return NextResponse.json({ streamContext, present });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isPdfEnvError =
      /Path2D|canvas|polyfill|pdf|PDF/.test(message) || message.includes("not supported in this environment");
    if (isPdfEnvError) {
      return NextResponse.json(
        {
          error: "Pitch deck upload failed",
          detail:
            "PDF upload is not supported in this environment. Please paste your pitch text into the box or upload a .txt or .docx file.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Ingestion failed", detail: message }, { status: 500 });
  }
}

/** Returns { text } on success or { error: userMessage } on failure. */
async function fileToTextSafe(file: File): Promise<{ text: string } | { error: string }> {
  const name = (file.name || "").toLowerCase();
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (name.endsWith(".pdf")) {
      try {
        const text = await extractPdfText(buf);
        return { text: text || "" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          error:
            msg.includes("not supported in this environment")
              ? msg
              : "This PDF could not be read (e.g. scanned image or unsupported format). Try pasting the text into the box, or upload a .txt or .docx file.",
        };
      }
    }
    if (name.endsWith(".docx")) {
      try {
        const text = await extractDocxText(buf);
        return { text: text || "" };
      } catch {
        return {
          error: "This DOCX could not be read. Try saving as .txt or paste the text into the box.",
        };
      }
    }
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      return { text: new TextDecoder().decode(buf).trim() };
    }
    return { error: "Unsupported format. Use .txt, .md, .pdf, or .docx." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message.slice(0, 200) };
  }
}
