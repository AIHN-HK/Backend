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

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://fixture',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};
it('requires distinct sufficiently long production JWT secrets and validates token TTLs', () => {
  expect(configValidationSchema.validate(production).error).toBeUndefined();
  expect(
    configValidationSchema.validate({
      ...production,
      JWT_ACCESS_SECRET: 'short',
    }).error,
  ).toBeDefined();
  expect(
    configValidationSchema.validate({
      ...production,
      JWT_REFRESH_SECRET: production.JWT_ACCESS_SECRET,
    }).error,
  ).toBeDefined();
  expect(
    configValidationSchema.validate({
      ...production,
      JWT_REFRESH_EXPIRATION: 'forever',
    }).error,
  ).toBeDefined();
  expect(
    configValidationSchema.validate({ ...production, OTP_HASH_SECRET: 'short' })
      .error,
  ).toBeDefined();
});
