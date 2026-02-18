import "server-only";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = "https://api.firecrawl.dev";

if (!FIRECRAWL_API_KEY) {
  // Fail fast on missing config in server env; better than silent partial behaviour
  // eslint-disable-next-line no-console
  console.warn("FIRECRAWL_API_KEY is not set; voice crawling will be disabled.");
}

interface FirecrawlPage {
  content?: string;
}

interface FirecrawlResponse {
  pages?: FirecrawlPage[];
}

export async function crawlUrl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
  }
  const res = await fetch(`${FIRECRAWL_BASE}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      includeSubdomains: false,
      maxDepth: 1,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl failed for ${url} (status ${res.status})`);
  }
  const json = (await res.json()) as FirecrawlResponse;
  const pages = json.pages ?? [];
  return pages
    .map((p) => (p.content ?? "").trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
}

