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
        const text = await fileToText(pubFile);
        if (text) {
          streamContext.PUBLIC_TRANSCRIPT = truncate(text, MAX_STREAM_CHARS);
          present.push("PUBLIC_TRANSCRIPT");
        }
      }
      if (privFile?.size && !streamContext.PRIVATE_DICTATION) {
        const text = await fileToText(privFile);
        if (text) {
          streamContext.PRIVATE_DICTATION = truncate(text, MAX_STREAM_CHARS);
          present.push("PRIVATE_DICTATION");
        }
      }
      if (pitchFile?.size && !streamContext.PITCH_MATERIAL) {
        const text = await fileToText(pitchFile);
        if (text) {
          streamContext.PITCH_MATERIAL = truncate(text, MAX_STREAM_CHARS);
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
    return NextResponse.json({ error: "Ingestion failed", detail: message }, { status: 500 });
  }
}

async function fileToText(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) return extractPdfText(buf);
  if (name.endsWith(".docx")) return extractDocxText(buf);
  if (name.endsWith(".txt") || name.endsWith(".md")) return new TextDecoder().decode(buf).trim();
  return "";
}
