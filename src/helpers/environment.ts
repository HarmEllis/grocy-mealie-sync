export function getEnvironmentVariable(key: string): string {
  const envVar = process.env[key];
  if (!envVar) {
    throw new Error(`Environment variable '${key}' is not set`);
  }
  return envVar;
}
