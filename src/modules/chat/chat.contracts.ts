import type { ResultService } from '../result';

export interface ChatMessageInput {
  sessionId: number;
  content: string;
}
export interface ChatJobData extends ChatMessageInput {
  turnId: string;
  userId: number;
}
export interface ChatTurnInput extends ChatJobData {
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onEnd: () => void;
}
export type AiStreamOutcome = 'completed' | 'cancelled';
export interface ChatTokenEvent {
  sessionId: number;
  turnId: string;
  token: string;
}
export type ChatEndEvent =
  | { sessionId: number; turnId: string; status: AiStreamOutcome }
  | {
      sessionId: number;
      turnId: string;
      status: 'failed';
      code: string;
      message: string;
    };

export interface ChatProfile {
  form_date: string;
  basic_info: {
    full_name: string;
    age: number;
    address: string | null;
    status: string;
  };
  self_understanding: {
    hobbies: string[];
    strengths: string[];
    favorite_subjects: string[];
    experience: string | null;
  };
  career_orientation: {
    has_chosen: boolean;
    considering_careers: string[] | null;
    target_schools: string[];
    important_factors: string[];
  };
  family_info: {
    father_job: string | null;
    mother_job: string | null;
    family_expectations: string | null;
    has_guidance: boolean;
    guidance_content: string | null;
  };
}
export interface PendingChatMessage {
  id: number;
  role: string | null;
  content: string;
}
export interface ChatContext {
  profile_json: ChatProfile;
  test_json: Awaited<ReturnType<ResultService['getResultRanking']>>;
}
export interface AiStreamInput {
  sessionId: number;
  turnId: string;
  message: string;
  profile_json: unknown;
  test_json: unknown;
  history: unknown[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function hasSessionId(
  value: unknown,
): value is { sessionId: number } & Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.sessionId === 'number' &&
    Number.isSafeInteger(value.sessionId) &&
    value.sessionId > 0
  );
}
export function isChatMessage(
  value: unknown,
): value is ChatMessageInput & Record<string, unknown> {
  return (
    hasSessionId(value) &&
    typeof value.content === 'string' &&
    !!value.content.trim() &&
    value.content.length <= 8000
  );
}
export function isChatJob(value: unknown): value is ChatJobData {
  return (
    isChatMessage(value) &&
    typeof value.turnId === 'string' &&
    value.turnId.length > 0 &&
    typeof value.userId === 'number' &&
    Number.isSafeInteger(value.userId) &&
    value.userId > 0
  );
}
