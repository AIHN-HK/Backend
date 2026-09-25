export class ChatSummaryDto {
  sessionId: number;
  history: {
    role: string;
    content: string;
  }[];
  existingSummary?: string;
}
