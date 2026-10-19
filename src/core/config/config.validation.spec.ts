import { configValidationSchema } from './config.validation';
import { allowedOrigins } from './cors.options';

it('treats empty optional deployment variables as absent without opening production CORS', () => {
  const result = configValidationSchema.validate({
    DATABASE_URL: 'postgresql://fixture',
    JWT_ACCESS_SECRET: 'fixture',
    JWT_REFRESH_SECRET: 'fixture',
    AI_WS_URL: '',
    CORS_ORIGINS: '',
  });
  expect(result.error).toBeUndefined();
  expect(result.value.AI_WS_URL).toBeUndefined();
  expect(allowedOrigins(result.value.CORS_ORIGINS, true)).toBe(false);
});
