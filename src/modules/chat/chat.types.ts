export interface ClientSendMessage {
  sessionId: number;
  content: string;
}

export interface ServerSendMessage {
  sessionId: number;
  content: string;
  createdAt: Date;
}
