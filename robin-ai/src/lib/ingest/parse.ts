/**
 * Parse PDF and DOCX to plain text. Used by ingestion API.
 * Mammoth is imported dynamically so DOCX parsing only loads when needed (avoids Vercel cold-start issues).
 */

const PDF_UNSUPPORTED_MSG =
  "PDF upload is not supported in this environment (e.g. Vercel serverless). Please paste your pitch text into the box or upload a .txt or .docx file.";

/** PDF: use pdf-parse only when not on Vercel (Path2D/canvas unavailable in serverless). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (process.env.VERCEL) {
    throw new Error(PDF_UNSUPPORTED_MSG);
  }
  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Path2D") || msg.includes("canvas") || msg.includes("polyfill")) {
      throw new Error(PDF_UNSUPPORTED_MSG);
    }
    throw e;
  }
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
