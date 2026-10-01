// Types for scripts/check-lock.mjs (imported by test/check-lock.test.ts).

export interface Lock { locked: boolean; reopened: Record<string, string[]> }
export interface FileDiff { before: string | null; after: string | null }
export interface LockVerdict { ok: boolean; why: string; refused: string[] }

export function defaultAssetGlobs(slug: string): string[];
export function allowGlobs(slug: string, extra: string[]): string[];
export const LINE_SCOPED: string[];
export function globToRegExp(glob: string): RegExp;
export function hasLeadTrailer(message: string): boolean;
export function lineScopedRefusals(path: string, before: string | null, after: string | null, slugs: [string, string[]][]): string[];
export function lockVerdict(message: string, paths: string[], lock: Lock, diffs: Record<string, FileDiff>): LockVerdict;
