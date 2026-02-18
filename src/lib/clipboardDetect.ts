/**
 * Detect if clipboard content looks like a transcript or a known doc URL
 * for "Smart Clipboard" autofill offer.
 */
const KNOWN_URL_PATTERNS = [
  /notion\.(so|site)/i,
  /substack\.com/i,
  /docs\.google\.com/i,
  /medium\.com/i,
  /github\.com/i,
];

const TRANSCRIPT_HINTS = [
  /Speaker\s*\d+/i,
  /^\d{1,2}:\d{2}(:\d{2})?\s/m,
  /Transcript/i,
  /\[?\d{1,2}:\d{2}\]?\s/g,
];

export type ClipboardOfferType = "transcript" | "link";

export interface ClipboardOffer {
  type: ClipboardOfferType;
  text: string;
}

function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return false;
  try {
    const u = new URL(trimmed);
    return KNOWN_URL_PATTERNS.some((p) => p.test(u.hostname));
  } catch {
    return false;
  }
}

function looksLikeTranscript(text: string): boolean {
  if (text.length < 200) return false;
  const lineCount = (text.match(/\n/g) || []).length;
  if (lineCount < 3) return false;
  return TRANSCRIPT_HINTS.some((p) => p.test(text));
}

export async function readClipboardOffer(): Promise<ClipboardOffer | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return null;
  try {
    const text = await navigator.clipboard.readText();
    if (!text?.trim()) return null;
    if (looksLikeUrl(text)) return { type: "link", text: text.trim() };
    if (looksLikeTranscript(text)) return { type: "transcript", text: text.trim() };
    return null;
  } catch {
    return null;
  }
}
