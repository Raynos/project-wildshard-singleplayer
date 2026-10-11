/** Canonical format/script-ABI wire revision. The format stays 0.x; every breaking revision migrates first-party data. */
export const SHARDFILE_VERSION = '0.1';
/** Explicit previous wire form; only visited first-party offline caches may use its bounded trusted reader. */
export const SHARDFILE_PREVIOUS_VERSION = 0;
/** Parse the decimal revision as a safe integer, never as a floating-point version (0.10 follows 0.9). */
export function shardfileRevision(input: unknown): number {
  if (typeof input !== 'string' || !/^0\.(?:0|[1-9][0-9]*)$/u.test(input)) throw new Error('Shardfile needs a canonical format version 0.<revision>');
  const revision = Number(input.slice(2));
  if (!Number.isSafeInteger(revision)) throw new Error('Shardfile format revision exceeds safe integer range');
  return revision;
}
