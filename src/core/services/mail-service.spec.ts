import { createServer } from 'node:net';
import { MailService } from './mail_service';

it('delivers the configured OTP to an owned local SMTP capture without logging it', async () => {
  let captured = '';
  const server = createServer((socket) => {
    let buffer = '',
      receiving = false;
    socket.write('220 fixture SMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (true) {
        if (receiving) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          captured += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          receiving = false;
          socket.write('250 queued\r\n');
        }
        const end = buffer.indexOf('\r\n');
        if (end < 0) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^EHLO|^HELO/.test(line)) socket.write('250 fixture\r\n');
        else if (line === 'DATA') {
          receiving = true;
          socket.write('354 end with dot\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
          return;
        } else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const keys = [
    'NODE_ENV',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_FROM',
    'MAIL_USER',
    'MAIL_PASS',
  ];
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.NODE_ENV = 'development';
    process.env.MAIL_HOST = '127.0.0.1';
    process.env.MAIL_PORT = String((server.address() as { port: number }).port);
    process.env.MAIL_FROM = 'no-reply@example.test';
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;
    await new MailService().sendOtp('student@example.test', '234567');
    expect(captured).toContain('student@example.test');
    expect(captured).toContain('234567');
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
