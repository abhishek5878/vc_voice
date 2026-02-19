import { describe, it, expect } from "vitest";
import {
  buildCalendarDescription,
  buildFollowUpEmailBody,
  buildReplyToFounderEmailBody,
  getRedListPreview,
  buildSlackSummary,
  buildGoogleCalendarEventUrl,
  buildOutlookCalendarEventUrl,
  pipelineResultToMarkdown,
} from "@/lib/reportMarkdown";
import type { PipelineResult } from "@/lib/pipeline/types";

function minimalResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    mode: 1,
    layer_1: { claims: [] },
    layer_2: { conflicts: [], skipped: true },
    layer_3: { grue_coverage: [], blind_spots: [], coverage_score: 0 },
    layer_4: { red_list: [], yellow_list: [], pedigree_flags: [] },
    ...overrides,
  };
}

describe("reportMarkdown", () => {
  describe("buildCalendarDescription", () => {
    it("returns header or fallback when no red/yellow content", () => {
      const r = minimalResult();
      const out = buildCalendarDescription(r);
      expect(out).toContain("PitchRobin");
      expect(out === "PitchRobin — Prep / Review" || out.includes("see app for full brief")).toBe(true);
    });

    it("mode 1: includes layer_4 red_list", () => {
      const r = minimalResult({
        layer_4: {
          red_list: [
            {
              question: "What is burn?",
              source_layer: "3",
              source_finding_id: "x",
              source_description: "grue",
              why_existential: "need to know",
            },
          ],
          yellow_list: [],
          pedigree_flags: [],
        },
      });
      expect(buildCalendarDescription(r)).toContain("Follow-up (red list)");
      expect(buildCalendarDescription(r)).toContain("What is burn?");
    });

    it("mode 2: includes pre_meeting_attack_brief red and yellow", () => {
      const r = minimalResult({
        mode: 2,
        pre_meeting_attack_brief: {
          red_list_framed: [
            { question: "Q1?", source_finding: "f1", framing: "f1" },
          ],
          yellow_list_framed: [
            { question: "Q2?", source_finding: "f2", framing: "f2" },
          ],
          recommended_sequence: [],
        },
      });
      const out = buildCalendarDescription(r);
      expect(out).toContain("RED LIST");
      expect(out).toContain("Q1?");
      expect(out).toContain("YELLOW LIST");
      expect(out).toContain("Q2?");
    });
  });

  describe("buildFollowUpEmailBody", () => {
    it("uses red list questions as topics and first ask", () => {
      const r = minimalResult({
        layer_4: {
          red_list: [
            {
              question: "What is your burn rate?",
              source_layer: "3",
              source_finding_id: "a",
              source_description: "d",
              why_existential: "w",
            },
          ],
          yellow_list: [],
          pedigree_flags: [],
        },
      });
      const body = buildFollowUpEmailBody(r, null);
      expect(body).toContain("Great chatting");
      expect(body).toContain("Robin flagged");
      expect(body).toContain("dig deeper");
      expect(body).toContain("Can you share data on");
    });

    it("includes meeting/company intro when meta provided", () => {
      const r = minimalResult({
        layer_4: {
          red_list: [
            {
              question: "Burn?",
              source_layer: "3",
              source_finding_id: "a",
              source_description: "d",
              why_existential: "w",
            },
          ],
          yellow_list: [],
          pedigree_flags: [],
        },
      });
      const body = buildFollowUpEmailBody(r, {
        meetingTitle: "Series A",
        companyName: "Acme",
      });
      expect(body).toContain("Following up on");
      expect(body).toContain("Series A");
      expect(body).toContain("Acme");
    });
  });

  describe("buildReplyToFounderEmailBody", () => {
    it("includes thanks, first red question, and blind spot when present", () => {
      const r = minimalResult({
        layer_3: { grue_coverage: [], blind_spots: ["retention cohorts"], coverage_score: 50 },
        layer_4: {
          red_list: [
            {
              question: "What is your burn rate?",
              source_layer: "3",
              source_finding_id: "a",
              source_description: "d",
              why_existential: "w",
            },
          ],
          yellow_list: [],
          pedigree_flags: [],
        },
      });
      const body = buildReplyToFounderEmailBody(r, { companyName: "Acme" });
      expect(body).toContain("Thanks");
      expect(body).toContain("burn rate");
      expect(body).toContain("retention cohorts");
      expect(body).toContain("Acme");
    });
  });

  describe("getRedListPreview", () => {
    it("returns empty array when no red list", () => {
      expect(getRedListPreview(minimalResult())).toEqual([]);
    });

    it("returns layer_4 red_list questions for mode 1", () => {
      const r = minimalResult({
        layer_4: {
          red_list: [
            {
              question: "Q1",
              source_layer: "1",
              source_finding_id: "a",
              source_description: "d",
              why_existential: "w",
            },
          ],
          yellow_list: [],
          pedigree_flags: [],
        },
      });
      expect(getRedListPreview(r)).toEqual(["Q1"]);
    });

    it("returns pre_meeting_attack_brief red_list_framed for mode 2", () => {
      const r = minimalResult({
        mode: 2,
        pre_meeting_attack_brief: {
          red_list_framed: [
            { question: "R1?", source_finding: "s", framing: "f" },
          ],
          yellow_list_framed: [],
          recommended_sequence: [],
        },
      });
      expect(getRedListPreview(r)).toEqual(["R1?"]);
    });
  });

  describe("buildSlackSummary", () => {
    it("includes mode label and meta when provided", () => {
      const r = minimalResult();
      const s = buildSlackSummary(r, {
        meetingTitle: "Sync",
        companyName: "Co",
      });
      expect(s).toContain("Sync");
      expect(s).toContain("Co");
      expect(s).toContain("Post-meeting");
    });
  });

  describe("buildGoogleCalendarEventUrl", () => {
    it("includes title from meta and description", () => {
      const url = buildGoogleCalendarEventUrl(
        { meetingTitle: "M", companyName: "C" },
        "Desc here"
      );
      expect(url).toContain("calendar.google.com");
      expect(url).toContain("action=TEMPLATE");
      expect(url).toContain("M");
      expect(url).toContain("C");
      expect(url).toContain("Desc"); // URL-encoded (e.g. Desc+here)
      expect(url).toContain("here");
    });
  });

  describe("buildOutlookCalendarEventUrl", () => {
    it("includes subject and body", () => {
      const url = buildOutlookCalendarEventUrl(
        { companyName: "OnlyCo" },
        "Body text"
      );
      expect(url).toContain("outlook.office.com");
      expect(url).toContain("OnlyCo");
      expect(url).toContain("Body"); // URL-encoded (e.g. Body+text)
      expect(url).toContain("text");
    });
  });

  describe("pipelineResultToMarkdown", () => {
    it("produces markdown with Evidence Map and layer sections", () => {
      const r = minimalResult({
        layer_1: {
          claims: [
            {
              id: "c1",
              claim: "We have 50% MoM growth",
              source_quote: "quote",
              status: "verified",
              category: "growth",
            },
          ],
        },
      });
      const md = pipelineResultToMarkdown(r, null);
      expect(md).toContain("# PitchRobin Analysis Report");
      expect(md).toContain("Evidence Map");
      expect(md).toContain("50% MoM growth");
      expect(md).toContain("verified");
    });

    it("escapes markdown-breaking characters in claims", () => {
      const r = minimalResult({
        layer_1: {
          claims: [
            {
              id: "c1",
              claim: "We have **bold** and # headers",
              source_quote: null,
              status: "unverified",
              category: "other",
            },
          ],
        },
      });
      const md = pipelineResultToMarkdown(r, null);
      expect(md).not.toContain("**bold**");
      expect(md).toContain("\\*\\*bold\\*\\*");
    });
  });
});
