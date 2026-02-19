const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = "https://api.firecrawl.dev";
const FIRECRAWL_SCRAPE_BASE = "https://api.firecrawl.dev/v0";

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

interface ScrapeResponse {
  success?: boolean;
  data?: { markdown?: string; content?: string };
}

/** Scrape a single URL (fast, one page). Use for time-bounded gathering. */
export async function scrapeUrl(url: string, timeoutMs = 30_000): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
  }
  const res = await fetch(`${FIRECRAWL_SCRAPE_BASE}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      timeout: Math.min(timeoutMs, 60_000),
    }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed for ${url} (status ${res.status})`);
  }
  const json = (await res.json()) as ScrapeResponse;
  const text = json.data?.markdown ?? json.data?.content ?? "";
  return text.trim();
}

/**
 * Scrape multiple URLs with a total time budget (e.g. 5 minutes).
 * Stops when budget is exceeded. Returns accumulated corpus and elapsed time.
 */
const DEFAULT_CRAWL_BUDGET_MS = 5 * 60 * 1000;
const PER_URL_TIMEOUT_MS = 45_000;

export async function scrapeUrlsWithTimeBudget(
  urls: string[],
  maxMs: number = DEFAULT_CRAWL_BUDGET_MS
): Promise<{ corpus: string; elapsedMs: number; hitBudget: boolean }> {
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  let corpus = "";
  const start = Date.now();
  let hitBudget = false;

  for (const url of unique) {
    if (Date.now() - start >= maxMs) {
      hitBudget = true;
      break;
    }
    const remaining = maxMs - (Date.now() - start);
    const timeout = Math.min(PER_URL_TIMEOUT_MS, Math.max(5000, remaining - 2000));
    try {
      const text = await Promise.race([
        scrapeUrl(url, timeout),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), timeout + 1000)
        ),
      ]);
      if (text) {
        corpus += `\n\n===== ${url} =====\n\n${text}`;
      }
    } catch {
      // Skip failed URLs and continue
    }
  }

  const elapsedMs = Date.now() - start;
  if (elapsedMs >= maxMs) hitBudget = true;
  return { corpus: corpus.trim(), elapsedMs, hitBudget };
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

