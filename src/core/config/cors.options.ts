export function allowedOrigins(value?: string, production = false) {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? !production
  );
}
