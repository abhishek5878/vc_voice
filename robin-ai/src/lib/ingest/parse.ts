/**
 * Parse PDF and DOCX to plain text. Used by ingestion API.
 */
import mammoth from "mammoth";

/** PDF: use pdf-parse Node API (PDFParse class, getText()) */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const text = (textResult as { text?: string }).text ?? "";
    await parser.destroy();
    return text.trim();
  } catch (e) {
    await parser.destroy().catch(() => {});
    throw e;
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value ?? "").trim();
}

export function truncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + "\n[... truncated]";
}

export const MAX_STREAM_CHARS = 50_000;
export const MIN_INPUT_CHARS = 200;
