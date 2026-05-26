/**
 * Returns true for transient transport/parsing errors that should not surface as hard failures.
 */
export function isIgnorableRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  return (
    normalized.includes('context canceled') ||
    normalized.includes('canceled') ||
    normalized.includes('unexpected end of json input')
  );
}
