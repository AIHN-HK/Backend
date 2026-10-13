import {
  RIASEC_KEYS,
  RiasecScore,
  AnalyzeMeta,
  RiasecCode,
} from './riasec.types';

const OPPOSITE_MAP: Record<RiasecCode, RiasecCode> = {
  R: 'S',
  S: 'R',
  I: 'E',
  E: 'I',
  A: 'C',
  C: 'A',
};

export function analyzeRiasec(
  topCode: string,
  scores: RiasecScore,
): AnalyzeMeta {
  const highCount = RIASEC_KEYS.filter(
    (k) => scores[k] >= 12 && scores[k] <= 18,
  ).length;

  const lowCount = RIASEC_KEYS.filter(
    (k) => scores[k] >= 3 && scores[k] <= 6,
  ).length;

  const codes = topCode.split('') as RiasecCode[];

  const top2 = (Object.entries(scores) as [RiasecCode, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code]) => code);

  const OPPOSITE_PAIR_MAP: Record<RiasecCode, string> = {
    R: 'R_S',
    S: 'R_S',
    I: 'I_E',
    E: 'I_E',
    A: 'A_C',
    C: 'A_C',
  };

  let oppositeCondition: string | null = null;

  if (top2.length === 2 && OPPOSITE_MAP[top2[0]] === top2[1]) {
    oppositeCondition = OPPOSITE_PAIR_MAP[top2[0]];
  }

  if (highCount === 6) {
    return { type: 'ALL_HIGH', condition: 'ALL_HIGH' };
  }

  if (lowCount === 6) {
    return { type: 'ALL_LOW', condition: 'ALL_LOW' };
  }

  if (oppositeCondition) {
    return { type: 'OPPOSITE', condition: oppositeCondition };
  }

  return { type: 'NORMAL', codes };
}
