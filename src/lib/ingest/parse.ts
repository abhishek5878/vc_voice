/**
 * Parse PDF, DOCX, and PPTX to plain text. Used by ingestion API.
 * PDF/PPT: OpenAI API (vision-capable model). DOCX: mammoth.
 */

const EXTRACT_PROMPT =
  "Extract all text from this document in order. Return only the extracted text, preserving order and structure. Do not add commentary or headings.";

/**
 * PDF: use OpenAI Responses API (gpt-4o) with base64 PDF. Works in serverless.
 * Requires OPENAI_API_KEY.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Set it in your environment for PDF extraction.");
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const base64 = buffer.toString("base64");
  const response = await client.responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", filename: "document.pdf", file_data: `data:application/pdf;base64,${base64}` },
          { type: "input_text", text: EXTRACT_PROMPT },
        ],
      },
    ],
  });
  const text = (response as { output_text?: string }).output_text?.trim() ?? "";
  return text;
}

/**
 * PPTX: use OpenAI Responses API (gpt-4o) with base64 PPTX if supported; otherwise fallback to JSZip.
 * Requires OPENAI_API_KEY for OpenAI path.
 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey });
      const base64 = buffer.toString("base64");
      const response = await client.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              { type: "input_file", filename: "slides.pptx", file_data: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}` },
              { type: "input_text", text: EXTRACT_PROMPT },
            ],
          },
        ],
      });
      const text = (response as { output_text?: string }).output_text?.trim() ?? "";
      if (text) return text;
    } catch {
      // OpenAI may not support PPTX; fall back to JSZip
    }
  }
  return extractPptxTextWithJszip(buffer);
}

async function extractPptxTextWithJszip(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((n) => n.match(/^ppt\/slides\/slide\d+\.xml$/i))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  const parts: string[] = [];
  for (const name of slideNames) {
    const file = zip.files[name];
    if (!file?.dir) {
      const xml = await file.async("string");
      const textMatches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
      const text = Array.from(textMatches)
        .map((m) => m[1])
        .join(" ");
      if (text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n\n");
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value ?? "").trim();
}

export function truncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + "\n[... truncated]";
}

export const MAX_STREAM_CHARS = 50_000;
export const MIN_INPUT_CHARS = 200;
