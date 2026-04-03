import type { McpActionResult } from './contracts';

export function createJsonResourceContents(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function getSingleVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function createJsonTextContent(data: unknown) {
  return {
    type: 'text' as const,
    text: JSON.stringify(data, null, 2),
  };
}

export function createOkResult<TData>(message: string, data: TData): McpActionResult<TData> {
  return {
    ok: true,
    status: 'ok',
    message,
    data,
  };
}

export function createSkippedResult<TData>(message: string, data: TData): McpActionResult<TData> {
  return {
    ok: true,
    status: 'skipped',
    message,
    data,
  };
}

export function formatCountMessage(count: number, singular: string, plural = `${singular}s`): string {
  return `Found ${count} ${count === 1 ? singular : plural}.`;
}
