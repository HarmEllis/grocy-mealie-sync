function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info: (...args: unknown[]) => console.log(`[${timestamp()}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${timestamp()}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${timestamp()}]`, ...args),
};
