export interface CachedBodyEvidence {
  unit: string;
  source: string;
  requested: number;
  files: { url: string; bytes: number }[];
  missing: string[];
  failures: { url: string; reason: string }[];
  readBytes: number;
  limited: string | null;
  limits: { urls: number; caches: number; bodyBytes: number; totalBytes: number; milliseconds: number };
}
export function cachedBodyEvidence(input: readonly string[]): Promise<CachedBodyEvidence>;
