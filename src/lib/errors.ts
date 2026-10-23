/**
 * Turns anything a backend call can throw into a message a person can read.
 *
 * `err instanceof Error ? err.message : fallback` hides the real reason
 * whenever the thrown value is a plain object with a `message` (Supabase
 * errors can arrive that way), so a failed post only ever said "Could not
 * post job." This reads `message` from any object and keeps the fallback for
 * values that carry nothing useful.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
