import { Injectable } from '@nestjs/common';

import * as WebSocket from 'ws';
import { ResultService } from '../result/result.service';
@Injectable()
export class AiService {
  constructor(private readonly resultService: ResultService) {}
  private endCallbackMap = new Map<number, () => void>();

  private wsMap = new Map<number, WebSocket>();
  async streamAsk(data: {
    sessionId: number;
    message: string;
    profile_json: any;
    test_json: any;
    history: any;
    onStart?: () => void;
    onToken: (token: string) => void;
    onEnd?: () => void;
    onError?: (err: string) => void;
  }) {
    const ws = new WebSocket(
      `ws://139.59.126.158:8000/ws/chat/${data.sessionId}`,
    );
    this.wsMap.set(data.sessionId, ws);
    ws.on('open', async () => {
      ws.send(
        JSON.stringify({
          message: data.message,
          sessionId: data.sessionId,

          profile_json: data.profile_json,
          test_json: data.test_json,
          history: data.history,
        }),
      );
    });

    ws.on('message', (raw) => {
      const payload = JSON.parse(raw.toString());

      if (payload.type === 'start') {
        data.onStart?.();
      }

      if (payload.type === 'token') {
        data.onToken(payload.content || '');
      }

      if (payload.type === 'end') {
        console.error(
          `[WS AI MESSAGE ERROR] Server AI trả về lỗi cho session ${data.sessionId}:`,
          payload,
        );
        const errorMessage =
          payload.content ||
          payload.message ||
          payload.error ||
          'AI error (No detail provided)';
        data.onError?.(errorMessage);

        data.onEnd?.();
        ws.close();
        this.wsMap.delete(data.sessionId);
      }

      if (payload.type === 'error') {
        data.onError?.(payload.content || 'AI error');
        data.onEnd?.();
        ws.close();
        this.wsMap.delete(data.sessionId);
      }
    });

    ws.on('close', () => {
      this.wsMap.delete(data.sessionId);
    });
    ws.on('error', (error) => {
      console.error(
        `[WS AI ERROR] Lỗi kết nối AI ở session ${data.sessionId}:`,
        error,
      );
      data.onError?.(error.message);
      data.onEnd?.();
      this.wsMap.delete(data.sessionId);
    });
  }
  async stopGeneration(sessionId: number) {
    const ws = this.wsMap.get(sessionId);
    if (ws) {
      ws.close();
      this.wsMap.delete(sessionId);
      this.endCallbackMap.get(sessionId)?.();
      this.endCallbackMap.delete(sessionId);
    }
  }
}
