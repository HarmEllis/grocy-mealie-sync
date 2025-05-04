if (process.env.NODE_ENV !== 'production') {
  // The .env is only used in development
  // Container environment variables should be used in production
  require('dotenv').config();
}

export function getEnvironmentVariable(key: string): string {
  const envVar = process.env[key];
  if (!envVar) {
    throw new Error(`Environment variable '${key}' is not set`);
  }
  return envVar;
}
