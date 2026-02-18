import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readClipboardOffer } from "@/lib/clipboardDetect";

describe("clipboardDetect", () => {
  let mockReadText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReadText = vi.fn();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { readText: mockReadText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when clipboard is empty", async () => {
    mockReadText.mockResolvedValue("");
    expect(await readClipboardOffer()).toBeNull();
    mockReadText.mockResolvedValue("   \n  ");
    expect(await readClipboardOffer()).toBeNull();
  });

  it("returns { type: 'link', text } for known URL patterns (many users)", async () => {
    const urls = [
      "https://notion.so/workspace/abc",
      "https://substack.com/@user/post",
      "https://docs.google.com/document/d/xyz",
      "https://medium.com/some-post",
      "https://github.com/org/repo",
    ];
    for (const url of urls) {
      mockReadText.mockResolvedValue(url);
      const offer = await readClipboardOffer();
      expect(offer).toEqual({ type: "link", text: url });
    }
  });

  it("returns null for URL that is too short or not in allowed list", async () => {
    mockReadText.mockResolvedValue("https://evil.com/phishing");
    expect(await readClipboardOffer()).toBeNull();
    mockReadText.mockResolvedValue("https://a.co"); // short
    expect(await readClipboardOffer()).toBeNull();
  });

  it("returns { type: 'transcript', text } for transcript-like content", async () => {
    const transcript = `Speaker 1: Hello and welcome.
00:00 - Intro
00:15 - We discussed the metrics.
Transcript of the meeting.
${"Lorem ipsum dolor sit amet. ".repeat(8)}`; // ensure length >= 200
    mockReadText.mockResolvedValue(transcript);
    const offer = await readClipboardOffer();
    expect(offer).toEqual({ type: "transcript", text: transcript.trim() });
  });

  it("returns null for short text even with Speaker", async () => {
    mockReadText.mockResolvedValue("Speaker 1: Hi");
    expect(await readClipboardOffer()).toBeNull();
  });

  it("returns null for plain paragraph (no URL, no transcript hints)", async () => {
    mockReadText.mockResolvedValue(
      "This is just a normal paragraph of text that is long enough but has no Speaker or timestamps or known URL."
    );
    expect(await readClipboardOffer()).toBeNull();
  });

  it("returns null when clipboard.readText throws (e.g. permission denied)", async () => {
    mockReadText.mockRejectedValue(new Error("Permission denied"));
    expect(await readClipboardOffer()).toBeNull();
  });
});
