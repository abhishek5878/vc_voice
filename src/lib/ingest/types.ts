export type StreamLabel = "PUBLIC_TRANSCRIPT" | "PRIVATE_DICTATION" | "PITCH_MATERIAL" | "PEDIGREE_DATA";

export interface StreamContext {
  PUBLIC_TRANSCRIPT?: string;
  PRIVATE_DICTATION?: string;
  PITCH_MATERIAL?: string;
  PEDIGREE_DATA?: string;
}

export interface IngestResult {
  streamContext: StreamContext;
  /** Which streams were present (for mode detection) */
  present: StreamLabel[];
}
