export interface RiskInputs {
  redFlags: number;
  contradictions: number;
  grueMissing: number;
  unverifiedRatio: number;
}

export function computeRiskScore(input: RiskInputs): number {
  const { redFlags, contradictions, grueMissing, unverifiedRatio } = input;
  const risk =
    8 * redFlags +
    12 * contradictions +
    5 * grueMissing +
    6 * (unverifiedRatio * 10);
  return Math.max(0, Math.min(100, Math.round(risk * 100) / 100));
}

export interface ClarityInputs {
  verifiedClaims: number;
  totalClaims: number;
  contradictions: number;
  grueCovered: number;
  totalGrue: number;
}

export function computeClarityScore(input: ClarityInputs): number {
  const { verifiedClaims, totalClaims, contradictions, grueCovered, totalGrue } = input;
  const claimPart = totalClaims > 0 ? (verifiedClaims / totalClaims) * 60 : 0;
  const contraPart = totalClaims > 0 ? (1 - contradictions / totalClaims) * 25 : 25;
  const gruePart = totalGrue > 0 ? (grueCovered / totalGrue) * 15 : 0;
  const clarity = claimPart + contraPart + gruePart;
  return Math.max(0, Math.min(100, Math.round(clarity * 100) / 100));
}

export interface ResistanceInputs {
  hardQuestions: number;
  directAnswers: number;
  deflections: number;
}

export function computeResistanceScore(input: ResistanceInputs): number {
  const { hardQuestions, directAnswers, deflections } = input;
  if (hardQuestions <= 0) return 100;
  const directPart = (directAnswers / hardQuestions) * 70;
  const deflectPart = (1 - deflections / hardQuestions) * 30;
  const resistance = directPart + deflectPart;
  return Math.max(0, Math.min(100, Math.round(resistance * 100) / 100));
}

export interface DealStrengthInputs {
  clarity: number;
  risk: number;
  resistance: number;
}

export function computeDealStrength(input: DealStrengthInputs): number {
  const { clarity, risk, resistance } = input;
  const deal_strength = clarity * 0.5 + (100 - risk) * 0.4 + resistance * 0.1;
  return Math.max(0, Math.min(100, Math.round(deal_strength * 100) / 100));
}
