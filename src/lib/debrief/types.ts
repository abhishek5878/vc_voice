/** Post-call analysis result (VC Whisper–style). */

export interface DebriefScores {
  overall: number; // 1–100
  clarity: number; // 1–100
  vision: number; // 1–100
  unfair_edge: number; // 1–100
}

export interface DebriefKeyMoment {
  quote: string;
  summary: string;
}

export interface DebriefAnalysis {
  headline: string;
  scores: DebriefScores;
  score_reasons: {
    overall: string;
    clarity: string;
    vision: string;
    unfair_edge: string;
  };
  narrative: {
    resonated: string[];
    lost_them: string[];
  };
  key_moments: {
    nailed: DebriefKeyMoment[];
    needs_work: DebriefKeyMoment[];
  };
  /** Filled by VC matching step (investors to reach out to next). */
  recommended_vcs?: RecommendedVC[];
}

export interface RecommendedVC {
  slug: string;
  display_name: string;
  fund?: string;
  twitter_url: string | null;
  linkedin_url: string | null;
  fit_pct: number;
  reason: string;
}

/** Pre-meeting context from deal run (for PRE/POST delta). */
export interface PreMeetingContext {
  clarity_score: number | null;
  risk_score: number | null;
  resistance_score: number | null;
  risk_label: string;
  resistance_label: string;
  red_flags_summary: string[];
}
