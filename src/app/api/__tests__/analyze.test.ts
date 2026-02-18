import { beforeAll, describe, it, expect } from "vitest";
import { POST } from "../analyze/route";

function nextRequest(
  body: unknown,
  opts: { auth?: string } = {}
) {
  const url = "https://localhost/api/analyze";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== undefined) headers["Authorization"] = `Bearer ${opts.auth}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/analyze", () => {
  beforeAll(() => {
    // Ensure server-side OPENAI_API_KEY check passes for these lightweight handler tests.
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
  });
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    }) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/JSON|Invalid/);
  });

  it("returns 400 when input is too short", async () => {
    const res = await POST(
      nextRequest(
        {
          streamContext: { PITCH_MATERIAL: "short" },
          mode: 1,
        },
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/short|full transcript|pitch/);
  });

  it("returns 400 when streams are only whitespace (no actual content)", async () => {
    const res = await POST(
      nextRequest(
        {
          streamContext: {
            PUBLIC_TRANSCRIPT: "   ",
            PITCH_MATERIAL: " ".repeat(400),
          },
          mode: 1,
        }
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/PUBLIC_TRANSCRIPT|PRIVATE_DICTATION|PITCH_MATERIAL|at least one/);
  });

  it("returns 400 for empty streamContext", async () => {
    const res = await POST(
      nextRequest({ streamContext: {}, mode: 1 })
    );
    expect(res.status).toBe(400);
  });
});
