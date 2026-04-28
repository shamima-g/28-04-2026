/**
 * Small wrapper around Vitest's built-in snapshot matcher.
 *
 * Normalises values before snapshotting so that dashboard HTML / generated
 * docs with volatile bits (timestamps, absolute paths, random IDs) produce
 * stable snapshots.
 */

export interface NormaliseOptions {
  /** Replace ISO timestamps with <TIMESTAMP>. */
  stripTimestamps?: boolean;
  /** Replace absolute paths containing tmpdir with <TMPDIR>. */
  stripTmpPaths?: boolean;
  /** Replace short git SHAs with <SHA>. */
  stripSha?: boolean;
  /** Replace auto-generated IDs (UUIDs, hex hashes) with <ID>. */
  stripIds?: boolean;
}

export function normalise(input: string, opts: NormaliseOptions = {}): string {
  const {
    stripTimestamps = true,
    stripTmpPaths = true,
    stripSha = true,
    stripIds = true,
  } = opts;

  let out = input;
  if (stripTimestamps) {
    out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<TIMESTAMP>');
    out = out.replace(/\d{4}-\d{2}-\d{2}[ _]\d{2}[:_]\d{2}[:_]\d{2}/g, '<TIMESTAMP>');
  }
  if (stripTmpPaths) {
    out = out.replace(/\/tmp\/[^"\s]+/g, '<TMPDIR>');
    out = out.replace(/[A-Z]:\\(?:Users|Temp|tmp)\\[^"\s]+/g, '<TMPDIR>');
    out = out.replace(/\/var\/folders\/[^"\s]+/g, '<TMPDIR>');
  }
  if (stripSha) {
    out = out.replace(/\b[0-9a-f]{7,40}\b/g, '<SHA>');
  }
  if (stripIds) {
    out = out.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
  }
  return out;
}
