import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket = require('ws');

export type AiStreamOutcome = 'completed' | 'cancelled';
export class AiStreamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const AI_SOCKET_FACTORY = 'AI_SOCKET_FACTORY';
export type AiSocketFactory = (url: string) => WebSocket;
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

@Injectable()
export class AiService implements OnModuleDestroy {
  private readonly active = new Map<
    number,
    { turnId: string; cancel: () => void }
  >();
  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(AI_SOCKET_FACTORY)
    private readonly factory?: AiSocketFactory,
  ) {}

  streamAsk(data: AiStreamInput): Promise<AiStreamOutcome> {
    if (data.signal?.aborted) return Promise.resolve('cancelled');
    if (this.active.has(data.sessionId)) {
      return Promise.reject(
        new AiStreamError('CHAT_BUSY', 'A turn is already active.'),
      );
    }
    const baseUrl = this.config.get<string>('AI_WS_URL');
    if (!baseUrl)
      return Promise.reject(
        new AiStreamError(
          'AI_NOT_CONFIGURED',
          'AI connection is not configured.',
        ),
      );
    const url = new URL(baseUrl);
    url.pathname =
      url.pathname.replace(/\/$/, '') + '/ws/chat/' + data.sessionId;

    return new Promise((resolve, reject) => {
      let settled = false;
      let socket: WebSocket;
      const timers: { connect?: NodeJS.Timeout; total?: NodeJS.Timeout } = {};
      let idleTimer: NodeJS.Timeout;
      let receivedLength = 0;
      const finish = (outcome: AiStreamOutcome, error?: AiStreamError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timers.connect);
        clearTimeout(idleTimer);
        clearTimeout(timers.total);
        data.signal?.removeEventListener('abort', cancel);
        if (this.active.get(data.sessionId)?.turnId === data.turnId)
          this.active.delete(data.sessionId);
        if (socket) {
          if (socket.readyState === WebSocket.OPEN) socket.close();
          else if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
        }
        if (error) reject(error);
        else resolve(outcome);
      };
      const fail = (code: string, message: string) =>
        finish('completed', new AiStreamError(code, message));
      const cancel = () => finish('cancelled');
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => fail('AI_TIMEOUT', 'AI stream timed out.'),
          this.config.get<number>('AI_IDLE_TIMEOUT_MS', 30000),
        );
      };
      this.active.set(data.sessionId, { turnId: data.turnId, cancel });
      data.signal?.addEventListener('abort', cancel, { once: true });
      if (data.signal?.aborted) {
        cancel();
        return;
      }
      try {
        socket = this.factory
          ? this.factory(url.toString())
          : new WebSocket(url, { maxPayload: 1024 * 1024 });
      } catch {
        fail('AI_CONNECTION_FAILED', 'AI connection failed.');
        return;
      }
      timers.connect = setTimeout(
        () => fail('AI_TIMEOUT', 'AI connection timed out.'),
        this.config.get<number>('AI_CONNECT_TIMEOUT_MS', 10000),
      );
      timers.total = setTimeout(
        () => fail('AI_TIMEOUT', 'AI stream exceeded its duration limit.'),
        this.config.get<number>('AI_MAX_DURATION_MS', 120000),
      );
      socket.on('open', () => {
        if (settled) return;
        clearTimeout(timers.connect);
        resetIdle();
        try {
          socket.send(
            JSON.stringify({
              sessionId: data.sessionId,
              message: data.message,
              profile_json: data.profile_json,
              test_json: data.test_json,
              history: data.history,
            }),
            (error) => {
              if (error)
                fail('AI_CONNECTION_FAILED', 'Could not send AI request.');
            },
          );
        } catch {
          fail('AI_CONNECTION_FAILED', 'Could not send AI request.');
        }
      });
      socket.on('message', (raw) => {
        if (settled) return;
        try {
          const payload = JSON.parse(raw.toString());
          if (
            !payload ||
            typeof payload !== 'object' ||
            !['start', 'token', 'end', 'error'].includes(payload.type)
          ) {
            fail('AI_PROTOCOL_ERROR', 'AI returned an invalid frame.');
            return;
          }
          resetIdle();
          if (payload.type === 'token') {
            if (typeof payload.content !== 'string') {
              fail('AI_PROTOCOL_ERROR', 'AI returned an invalid token.');
              return;
            }
            receivedLength += payload.content.length;
            if (receivedLength > 256000) {
              fail('AI_PROTOCOL_ERROR', 'AI response exceeded its size limit.');
              return;
            }
            data.onToken(payload.content);
          } else if (payload.type === 'end') {
            finish('completed');
          } else if (payload.type === 'error') {
            fail('AI_REMOTE_ERROR', 'AI could not complete this turn.');
          }
        } catch {
          fail('AI_PROTOCOL_ERROR', 'AI returned an invalid frame.');
        }
      });
      socket.on('error', () =>
        fail('AI_CONNECTION_FAILED', 'AI connection failed.'),
      );
      socket.on('close', () => {
        if (!settled)
          fail(
            'AI_CONNECTION_CLOSED',
            'AI closed before completing this turn.',
          );
      });
    });
  }

  stopGeneration(sessionId: number, turnId?: string) {
    const current = this.active.get(sessionId);
    if (current && (!turnId || turnId === current.turnId)) current.cancel();
  }

  onModuleDestroy() {
    for (const current of this.active.values()) current.cancel();
  }
}
