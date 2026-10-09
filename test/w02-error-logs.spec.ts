import { Logger } from '@nestjs/common';
import { throwError, firstValueFrom } from 'rxjs';
import { LoggingInterceptor } from '../src/core/interceptors/logging.interceptor';
it('request errors never log credential-bearing stacks', async () => {
  const quiet = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => {});
  const spy = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  try {
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/auth/login' }),
        getResponse: () => ({ statusCode: 500 }),
      }),
    };
    await expect(
      firstValueFrom(
        new LoggingInterceptor().intercept(context, {
          handle: () => throwError(() => new Error('password=secret-value')),
        }),
      ),
    ).rejects.toThrow();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-value');
  } finally {
    spy.mockRestore();
    quiet.mockRestore();
  }
});
