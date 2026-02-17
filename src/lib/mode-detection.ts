/**
 * Mode detection from stream context (for UI to show mode selector when ambiguous).
 */
import type { StreamContext } from "@/lib/ingest/types";

export type SuggestedMode = 1 | 2 | 3 | null;

/**
 * Returns suggested mode or null if user must choose (e.g. pitch-only → 2 vs 3).
 */
export function suggestMode(streamContext: StreamContext): SuggestedMode {
  const hasPublic = Boolean(streamContext.PUBLIC_TRANSCRIPT?.trim());
  const hasPrivate = Boolean(streamContext.PRIVATE_DICTATION?.trim());
  const hasPitch = Boolean(streamContext.PITCH_MATERIAL?.trim());

  if (hasPublic && hasPrivate) return 1;
  if (hasPublic && !hasPitch) return 1;
  if (hasPitch && !hasPublic && !hasPrivate) return null; // ask: founder (3) or VC (2)
  if (hasPitch && (hasPublic || hasPrivate)) return 1;
  return null;
}

export function getModePrompt(suggested: SuggestedMode): string | null {
  if (suggested !== null) return null;
  return "Are you a founder hardening your pitch (Mode 3) or a VC prepping for a meeting (Mode 2)?";
}
