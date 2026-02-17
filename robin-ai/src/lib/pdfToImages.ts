/**
 * Client-only: render PDF to image data URLs using pdfjs-dist (browser).
 * Used to send pages to OpenAI vision for text extraction.
 */

const MAX_PAGES = 20;
const SCALE = 1.5;
const JPEG_QUALITY = 0.85;

export async function pdfFileToImageDataUrls(file: File): Promise<string[]> {
  if (typeof window === "undefined") return [];

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");
  const version = (pdfjsLib as { version?: string }).version || "5.4.624";
  if (!(pdfjsLib as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions?.workerSrc) {
    (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }

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
