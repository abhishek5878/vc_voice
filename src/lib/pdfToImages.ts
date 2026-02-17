/**
 * Client-only: PDF text extraction and optional image export using pdfjs-dist (browser).
 * - pdfFileToText: extract text directly (no server). Use for text-based PDFs.
 * - pdfFileToImageDataUrls: render pages to images for OpenAI vision (scanned PDFs).
 */

const MAX_PAGES = 20;
const SCALE = 1.5;
const JPEG_QUALITY = 0.85;

type TextItem = { str: string; hasEOL?: boolean };

async function getPdfLib() {
  const pdfjsLib = await import("pdfjs-dist");
  const version = (pdfjsLib as { version?: string }).version || "5.4.624";
  if (!(pdfjsLib as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions?.workerSrc) {
    (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

/** Extract text from a PDF file in the browser (no server). Works for text-based PDFs; scanned PDFs return little or no text. */
export async function pdfFileToText(file: File): Promise<string> {
  if (typeof window === "undefined") return "";

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfLib();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  const parts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = (textContent?.items ?? []) as TextItem[];
    let line = "";
    for (const item of items) {
      line += item.str ?? "";
      if (item.hasEOL) {
        parts.push(line);
        line = "";
      }
    }
    if (line) parts.push(line);
    if (i < numPages) parts.push("");
  }

  return parts.join("\n").trim();
}

export async function pdfFileToImageDataUrls(file: File): Promise<string[]> {
  if (typeof window === "undefined") return [];

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfLib();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  const dataUrls: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const renderTask = page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      canvas,
      viewport,
    });
    await (renderTask as { promise: Promise<void> }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    dataUrls.push(dataUrl);
  }

  return dataUrls;
}
