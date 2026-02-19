/**
 * POST /api/extract-pitch
 * Body: multipart/form-data with field "file" (PDF, DOCX, or PPTX).
 * Returns: { text: string } or { error: string }.
 * For founders uploading a deck to use as pitch material.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractPdfText, extractDocxText, extractPptxText } from "@/lib/ingest/parse";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Send a file as multipart/form-data with field 'file'." }, { status: 400 });
  }
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const name = (file.name || "").toLowerCase();
  if (![".pdf", ".docx", ".pptx"].some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: "Unsupported format. Use PDF, DOCX, or PPTX." },
      { status: 400 }
    );
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (name.endsWith(".pdf")) {
      try {
        text = await extractPdfText(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            error: msg.includes("OPENAI_API_KEY")
              ? "PDF extraction requires OPENAI_API_KEY to be set on the server."
              : "This PDF could not be read. Try pasting the text or upload DOCX/PPTX.",
          },
          { status: 400 }
        );
      }
    } else if (name.endsWith(".docx")) {
      text = await extractDocxText(buf);
    } else {
      text = await extractPptxText(buf);
    }
    return NextResponse.json({ text: (text || "").trim() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Could not extract text from file.", detail: message.slice(0, 200) },
      { status: 500 }
    );
  }
}
