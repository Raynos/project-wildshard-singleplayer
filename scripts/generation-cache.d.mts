/** Exact producer identity; all paths are relative, hashes are SHA256 and outputs live in the supplied stage. */
export interface GenerationJob {
  id: string; inputs: Record<string, string>; command: string[]; outputs: string[];
  platform: 'portable' | 'native' | 'darwin'; tools?: Record<string, string>;
}
/** Native jobs execute on every host; Darwin-only jobs are a separate bit-exactness restriction. */
export interface GenerationOptions {
  cacheDir?: string; platform?: string; arch?: string; forceCompare?: boolean;
  generate: (directory: string) => Promise<void>;
}
/** A verified immutable directory with the digest of every declared generated file. */
export interface GenerationResult { directory: string; key: string; hit: boolean; hashes: Record<string, string>; elapsedMs: number }
/** Persistent shared cache root; WILDSHARD_GENERATE_CACHE can select another directory. */
export function generationCacheRoot(env?: NodeJS.ProcessEnv): string;
/** Key exact input contents, command, tool versions and native host identity. */
export function generationKey(root: string, job: GenerationJob, host?: {platform?: string; arch?: string}): string;
/** Verify every output is a regular file inside its generated directory and return SHA256 digests. */
export function generationOutputHashes(directory: string, outputs: string[]): Record<string, string>;
/** Coalesced, atomic cold generation; verified warm hits; optional fresh regenerate-and-compare. */
export function runGenerationJob(root: string, job: GenerationJob, options: GenerationOptions): Promise<GenerationResult>;
