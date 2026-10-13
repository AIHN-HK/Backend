import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from '../src/modules/chat/chat.gateway';
describe('socket access-token renewal', () => {
  it('renews same-owner socket auth without changing session; rejects other owners', async () => {
    const jwt = new JwtService({ secret: 'socket-refresh-test' });
    const old = jwt.sign({ userId: 1 }, { expiresIn: -1 });
    const fresh = jwt.sign({ userId: 1 }, { expiresIn: 600 });
    const other = jwt.sign({ userId: 2 });
    const gateway: any = new ChatGateway(
      {} as any,
      { user: { findUnique: async () => ({ id: 1 }) } } as any,
      jwt,
      {} as any,
      {} as any,
    );
    const socket: any = {
      handshake: { auth: { token: old } },
      data: { user: { userId: 1 }, sessionId: 10 },
      emit: () => {},
    };
    await gateway.handleRefreshAuth({ token: fresh }, socket);
    expect(socket.handshake.auth.token).toBe(fresh);
    expect(socket.data.sessionId).toBe(10);
    await gateway.handleRefreshAuth({ token: other }, socket);
    expect(socket.handshake.auth.token).toBe(fresh);
    await gateway.handleRefreshAuth({ token: old }, socket);
    expect(socket.handshake.auth.token).toBe(fresh);
  });
});
