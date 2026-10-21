import type { InputHashMemo } from './bake-input-hashes.mjs';
/** Exact producer identity; all paths are relative, hashes are SHA256 and outputs live in the supplied stage. */
export interface GenerationJob {
  id: string; inputs: Record<string, string>; command: string[]; outputs: string[];
  platform: 'portable' | 'native' | 'darwin'; tools?: Record<string, string>;
}
/** Native jobs execute on every host; Darwin-only jobs are a separate bit-exactness restriction. */
export interface GenerationOptions {
  inputHashes?: InputHashMemo; cacheDir?: string; platform?: string; arch?: string; forceCompare?: boolean;
  generate: (directory: string) => Promise<void>;
}
/** A verified immutable directory with the digest of every declared generated file. */
export interface GenerationResult { directory: string; key: string; hit: boolean; hashes: Record<string, string>; elapsedMs: number; /** Hold the cache read lease through every consumer copy; release when done. Dead process leases are reaped. */release:()=>void }
/** Persistent shared cache root; WILDSHARD_GENERATE_CACHE can select another directory. */
export function generationCacheRoot(env?: NodeJS.ProcessEnv): string;
/** Key exact input contents, command, tool versions and native host identity. */
export function generationKey(root: string, job: GenerationJob, host?: {platform?: string; arch?: string; inputHashes?:InputHashMemo}): string;
/** Verify every output is a regular file inside its generated directory and return SHA256 digests. */
export function generationOutputHashes(directory: string, outputs: string[]): Record<string, string>;
/** Coalesced, atomic cold generation; verified warm hits; optional fresh regenerate-and-compare. */
export function runGenerationJob(root: string, job: GenerationJob, options: GenerationOptions): Promise<GenerationResult>;
/** G430 eviction knobs: newest entries kept per job, the whole-cache cap, directories that always survive. */
export interface PruneOptions { keep?: number; capBytes?: number; protect?: string[]; dryRun?: boolean }
/** What a prune deleted (or, dry, would delete) and what it kept. */
export interface PruneReport {
  deleted: { job: string; key: string; bytes: number; reason: 'keep' | 'cap' }[];
  keptBytes: number; keptEntries: number; locked: number; freedBytes: number;
}
/** Keep the newest entries per job, then cap the cache, least recently used first; locked entries are never touched. */
export function pruneGenerationCache(cacheDir: string, options?: PruneOptions): PruneReport;
/** Prune at most once per 10 minutes per cache; never throws. */
export function maybePruneGenerationCache(cacheDir: string, options?: PruneOptions): PruneReport | undefined;
