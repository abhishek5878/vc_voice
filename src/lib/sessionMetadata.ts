import type { StreamContext } from "@/lib/ingest/types";

export interface SessionMetadata {
  meetingTitle: string;
  companyName: string;
  calendarEventUrl: string;
}

export const DEFAULT_SESSION_METADATA: SessionMetadata = {
  meetingTitle: "",
  companyName: "",
  calendarEventUrl: "",
};

/** Last run saved to localStorage for "Duplicate last run" and report context */
export interface LastRunSnapshot {
  mode: 1 | 2 | 3;
  streamContext: StreamContext;
  metadata: SessionMetadata;
  timestamp: number;
  provider?: "openai" | "anthropic" | "groq";
  model?: string;
}

/** Single recent run for Command Palette / quick access */
export interface RecentRunEntry {
  id: string;
  mode: 1 | 2 | 3;
  meetingTitle: string;
  companyName: string;
  timestamp: number;
  redListPreview: string[];
}

const STORAGE_LAST_RUN = "robin_last_run";
const STORAGE_SESSION_METADATA = "robin_session_metadata";
const STORAGE_RECENT_RUNS = "robin_recent_runs";
const MAX_RECENT_RUNS = 10;

export function loadLastRun(): LastRunSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_LAST_RUN);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastRunSnapshot;
    if (parsed?.streamContext && typeof parsed.mode === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveLastRun(snapshot: LastRunSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_LAST_RUN, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadSessionMetadata(): SessionMetadata {
  if (typeof window === "undefined") return { ...DEFAULT_SESSION_METADATA };
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_METADATA);
    if (!raw) return { ...DEFAULT_SESSION_METADATA };
    const parsed = JSON.parse(raw) as Partial<SessionMetadata>;
    return { ...DEFAULT_SESSION_METADATA, ...parsed };
  } catch {
    return { ...DEFAULT_SESSION_METADATA };
  }
}

export function saveSessionMetadata(meta: Partial<SessionMetadata>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadSessionMetadata();
    const next = { ...current, ...meta };
    localStorage.setItem(STORAGE_SESSION_METADATA, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadRecentRuns(): RecentRunEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_RUNS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_RUNS) : [];
  } catch {
    return [];
  }
}

export function pushRecentRun(entry: Omit<RecentRunEntry, "id">): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadRecentRuns();
    const newEntry: RecentRunEntry = { ...entry, id: `run-${Date.now()}-${(Math.random() * 1e9).toString(36)}` };
    const next = [newEntry, ...list.filter((r) => r.id !== newEntry.id)].slice(0, MAX_RECENT_RUNS);
    localStorage.setItem(STORAGE_RECENT_RUNS, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
