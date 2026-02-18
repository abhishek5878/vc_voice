export interface Deal {
  id: string;
  user_id: string;
  company_name: string;
  vertical: string | null;
  stage: string | null;
  status: "new" | "meeting" | "diligence" | "invested" | "passed" | "inbound";
  conviction_score: number | null;
  outcome: "invested" | "declined" | "failed" | "3x" | "10x" | "zombie" | null;
  share_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealRun {
  id: string;
  deal_id: string;
  mode: 1 | 2 | 3;
  report_json: unknown;
  red_flags: RedFlagItem[];
  yellow_flags: YellowFlagItem[];
  claims: ClaimItem[];
  grue_scores: GrueScoreItem[] | null;
  risk_score: number | null;
  clarity_score: number | null;
  interrogation_resistance: number | null;
  resistance_score: number | null;
  deal_strength: number | null;
  created_at: string;
}

export interface RedFlagItem {
  question: string;
  source_description?: string;
  why_existential?: string;
}

export interface YellowFlagItem {
  question: string;
  source_description?: string;
}

export interface ClaimItem {
  claim: string;
  source_quote: string | null;
  status: "verified" | "unverified" | "contradicted";
  category?: string;
}

export interface GrueScoreItem {
  metric: string;
  domain: string;
  status: string;
}

export interface FounderClaimRow {
  id: string;
  deal_id: string;
  run_id: string | null;
  claim_text: string;
  source_quote: string | null;
  status: "verified" | "unverified" | "contradicted" | "changed";
  created_at: string;
}

export interface ClaimDriftItem {
  id: string;
  original_claim: string;
  latest_claim: string;
  status: string;
  created_at: string;
}
