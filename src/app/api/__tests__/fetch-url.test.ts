import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../fetch-url/route";

function nextRequest(body: unknown, url = "https://localhost/api/fetch-url") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/fetch-url", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: () => Promise.resolve("<html><body>Some content from the page that is long enough.</body></html>"),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 when url is missing", async () => {
    const res = await POST(nextRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing url");
  });

  it("returns 400 when url is not a string", async () => {
    const res = await POST(nextRequest({ url: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported host", async () => {
    const res = await POST(nextRequest({ url: "https://evil.com/page" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/supported site|HTTPS/);
  });

  it("returns 400 for http (non-https)", async () => {
    const res = await POST(nextRequest({ url: "http://notion.so/page" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when remote returns 401", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as Response);
    const res = await POST(nextRequest({ url: "https://notion.so/private-doc" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/login|paste|public/);
  });

  it("returns 403 when remote returns 403", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
    } as Response);
    const res = await POST(nextRequest({ url: "https://docs.google.com/document/d/xyz" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/login|paste|public/);
  });

  it("returns 200 and text for allowed URL with enough content", async () => {
    const res = await POST(nextRequest({ url: "https://notion.so/some-page" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBeDefined();
    expect(data.text.length).toBeGreaterThanOrEqual(10);
  });
});
