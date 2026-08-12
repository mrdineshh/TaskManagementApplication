/**
 * Opaque cursor pagination per docs/04-API-SPEC.md §1 — base64 of the last row's
 * `id` + sort value, chosen over offset pagination so concurrent writes to
 * frequently-mutated task lists don't skip/duplicate rows.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor?: string): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
