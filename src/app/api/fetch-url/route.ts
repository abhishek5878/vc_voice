import { NextRequest, NextResponse } from "next/server";

/** Server-side fetch of a URL; returns plain text for use as pitch/transcript. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : null;
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }
    const parsed = new URL(url);
    const allowedHosts = [
      "docs.google.com",
      "www.docs.google.com",
      "drive.google.com",
      "www.drive.google.com",
      "notion.so",
      "www.notion.so",
      "notion.site",
      "github.com",
      "raw.githubusercontent.com",
      "gist.githubusercontent.com",
      "gist.github.com",
      "pastebin.com",
      "medium.com",
      "www.medium.com",
      "substack.com",
      "www.substack.com",
      "hastebin.com",
      "paste.ee",
    ];
    const allowed = allowedHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
    if (!allowed || !parsed.protocol.startsWith("https")) {
      return NextResponse.json(
        { error: "Use an HTTPS link from a supported site (Google Docs, Notion, GitHub, Medium, Substack, etc.)." },
        { status: 400 }
      );
    }
    const res = await fetch(url, {
      headers: { "User-Agent": "RobinBot/1.0 (fetch for pitch material)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") ?? "";
    let text: string;
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as unknown;
      text = typeof json === "string" ? json : JSON.stringify(json, null, 2);
    } else {
      text = await res.text();
    }
    if (contentType.includes("text/html") && text) {
      text = text
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
    }
    if (!text || text.length < 10) {
      return NextResponse.json({ error: "No text content at URL" }, { status: 400 });
    }
    const maxLen = 200_000;
    if (text.length > maxLen) text = text.slice(0, maxLen) + "\n\n[truncated]";
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
