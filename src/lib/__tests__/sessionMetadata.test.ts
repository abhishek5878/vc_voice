import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSessionMetadata,
  saveSessionMetadata,
  loadLastRun,
  saveLastRun,
  loadRecentRuns,
  pushRecentRun,
  DEFAULT_SESSION_METADATA,
} from "@/lib/sessionMetadata";
import type { StreamContext } from "@/lib/ingest/types";

const emptyContext: StreamContext = {
  PUBLIC_TRANSCRIPT: "",
  PRIVATE_DICTATION: "",
  PITCH_MATERIAL: "",
};

describe("sessionMetadata", () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.clear();
    }
  });

  describe("loadSessionMetadata / saveSessionMetadata", () => {
    it("returns defaults when nothing saved", () => {
      const meta = loadSessionMetadata();
      expect(meta).toEqual(DEFAULT_SESSION_METADATA);
    });

    it("persists and restores partial metadata (one user)", () => {
      saveSessionMetadata({ meetingTitle: "Standup", companyName: "Acme" });
      expect(loadSessionMetadata()).toMatchObject({
        meetingTitle: "Standup",
        companyName: "Acme",
      });
    });

    it("merges with existing (second user overwrites only set fields)", () => {
      saveSessionMetadata({
        meetingTitle: "A",
        companyName: "B",
        calendarEventUrl: "https://calendar.link/1",
      });
      saveSessionMetadata({ companyName: "B2" });
      expect(loadSessionMetadata()).toMatchObject({
        meetingTitle: "A",
        companyName: "B2",
        calendarEventUrl: "https://calendar.link/1",
      });
    });
  });

  describe("loadLastRun / saveLastRun", () => {
    it("returns null when nothing saved", () => {
      expect(loadLastRun()).toBeNull();
    });

    it("persists and restores last run with provider", () => {
      saveLastRun({
        mode: 1,
        streamContext: {
          ...emptyContext,
          PUBLIC_TRANSCRIPT: "Transcript here",
        },
        metadata: {
          meetingTitle: "M",
          companyName: "C",
          calendarEventUrl: "",
        },
        timestamp: 12345,
        provider: "anthropic",
      });
      const run = loadLastRun();
      expect(run).not.toBeNull();
      expect(run!.mode).toBe(1);
      expect(run!.provider).toBe("anthropic");
      expect(run!.streamContext.PUBLIC_TRANSCRIPT).toBe("Transcript here");
      expect(run!.metadata.companyName).toBe("C");
    });

    it("handles malformed stored data gracefully", () => {
      if (typeof globalThis.localStorage === "undefined") return;
      globalThis.localStorage.setItem("robin_last_run", "not json");
      expect(loadLastRun()).toBeNull();
      globalThis.localStorage.setItem("robin_last_run", "{}");
      expect(loadLastRun()).toBeNull();
      globalThis.localStorage.setItem(
        "robin_last_run",
        JSON.stringify({ mode: 1 })
      );
      expect(loadLastRun()).toBeNull(); // missing streamContext
    });
  });

  describe("loadRecentRuns / pushRecentRun", () => {
    it("returns empty array when nothing saved", () => {
      expect(loadRecentRuns()).toEqual([]);
    });

    it("stores and returns recent runs (multiple users / runs)", () => {
      pushRecentRun({
        mode: 1,
        meetingTitle: "M1",
        companyName: "C1",
        timestamp: 1000,
        redListPreview: ["Q1", "Q2"],
      });
      pushRecentRun({
        mode: 2,
        meetingTitle: "M2",
        companyName: "C2",
        timestamp: 2000,
        redListPreview: [],
      });
      const runs = loadRecentRuns();
      expect(runs).toHaveLength(2);
      expect(runs[0].meetingTitle).toBe("M2");
      expect(runs[0].redListPreview).toEqual([]);
      expect(runs[1].meetingTitle).toBe("M1");
      expect(runs[1].redListPreview).toEqual(["Q1", "Q2"]);
      expect(runs.every((r) => r.id && r.id.startsWith("run-"))).toBe(true);
    });

    it("caps at MAX_RECENT_RUNS (10)", () => {
      for (let i = 0; i < 15; i++) {
        pushRecentRun({
          mode: 1,
          meetingTitle: `M${i}`,
          companyName: `C${i}`,
          timestamp: 3000 + i,
          redListPreview: [],
        });
      }
      const runs = loadRecentRuns();
      expect(runs).toHaveLength(10);
    });
  });
});
