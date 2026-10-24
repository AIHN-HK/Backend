import type { RiasecCode, RiasecScore } from '../assessment';

export type GuestQuestion = {
  id: number;
  content: string;
  type: RiasecCode;
  dimension: 'PERSONA' | 'ABILITY' | 'INTEREST' | null;
};
export type GuestCatalog = {
  version: 1;
  kind: 'catalog';
  id: string;
  expiresAt: number;
  questions: GuestQuestion[];
  priorities: { type: RiasecCode; priority: number }[];
};
export type GuestReceipt = Omit<GuestCatalog, 'kind'> & {
  kind: 'receipt';
  answers: { questionId: number; check: boolean }[];
  completedAt: string;
};
export type GuestOutcome = { scores: RiasecScore; topCode: string };
