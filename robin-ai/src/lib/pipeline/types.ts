/** Layer 1 — Semantic Evidence Extractor */
export interface Layer1Claim {
  id: string;
  claim: string;
  source_quote: string | null;
  status: "verified" | "unverified" | "contradicted";
  category: "growth" | "retention" | "unit_economics" | "market" | "team" | "moat" | "other";
}

export interface Layer1Output {
  claims: Layer1Claim[];
}

/** Layer 2 — Cross-Stream Conflict Detector */
export interface Layer2Conflict {
  id: string;
  type: "A" | "B" | "C";
  stream_1_quote: string;
  stream_2_quote: string;
  severity: "low" | "medium" | "high";
  strategic_implication: string;
}

export interface Layer2Output {
  conflicts: Layer2Conflict[];
  conflict_summary?: string;
  skipped?: boolean;
  skip_reason?: string;
}

/** Layer 3 — GRUE coverage */
export interface Layer3Metric {
  metric: string;
  domain: "growth" | "retention" | "unit_economics" | "moat" | "team";
  status: "mentioned" | "underspecified" | "missing";
  source_quote: string | null;
  blind_spot_severity: "low" | "medium" | "high" | null;
}

export interface Layer3Output {
  grue_coverage: Layer3Metric[];
  blind_spots: string[];
  coverage_score: number;
}

/** Layer 4 — Conviction Interrogation */
export interface Layer4RedItem {
  question: string;
  source_layer: "1" | "2" | "3";
  source_finding_id: string;
  source_description: string;
  why_existential: string;
}

export interface Layer4YellowItem {
  question: string;
  source_layer: "1" | "2" | "3";
  source_finding_id: string;
  source_description: string;
}

export interface Layer4PedigreeFlag {
  flag: string;
  severity: "low" | "medium" | "high";
}

export interface Layer4Output {
  red_list: Layer4RedItem[];
  yellow_list: Layer4YellowItem[];
  pedigree_flags: Layer4PedigreeFlag[];
  interrogation_sequence?: string[];
}

export interface PipelineInput {
  streamContext: {
    PUBLIC_TRANSCRIPT?: string;
    PRIVATE_DICTATION?: string;
    PITCH_MATERIAL?: string;
    PEDIGREE_DATA?: string;
  };
  mode: 1 | 2 | 3;
  apiKey: string;
  provider: "openai" | "anthropic" | "groq";
  model?: string;
}

export interface PipelineResult {
  mode: 1 | 2 | 3;
  layer_1: Layer1Output;
  layer_2: Layer2Output | null;
  layer_3: Layer3Output;
  layer_4: Layer4Output;
  pre_meeting_attack_brief?: PreMeetingAttackBrief;
  error?: string;
}

export interface PreMeetingAttackBrief {
  red_list_framed: { question: string; source_finding: string; framing: string }[];
  yellow_list_framed: { question: string; source_finding: string; framing: string }[];
  recommended_sequence: string[];
}
