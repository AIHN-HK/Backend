export class AiStreamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function chatFailure(error: unknown) {
  return {
    code: error instanceof AiStreamError ? error.code : 'CHAT_TURN_FAILED',
    message:
      'Không thể hoàn tất lượt chat. Hãy kiểm tra lịch sử trước khi gửi lại.',
  };
}
