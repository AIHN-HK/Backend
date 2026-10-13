export type RiasecCode = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
export const RIASEC_KEYS = ['R', 'I', 'A', 'S', 'E', 'C'] as const;

export interface RiasecScore {
  R: number;
  I: number;
  A: number;
  S: number;
  E: number;
  C: number;
}
export enum RiasecType {
  R = 'R',
  I = 'I',
  A = 'A',
  S = 'S',
  E = 'E',
  C = 'C',
}
export type AnalyzeMeta =
  | { type: 'ALL_HIGH'; condition: 'ALL_HIGH' }
  | { type: 'ALL_LOW'; condition: 'ALL_LOW' }
  | { type: 'OPPOSITE'; condition: string }
  | { type: 'NORMAL'; codes: RiasecCode[] };
