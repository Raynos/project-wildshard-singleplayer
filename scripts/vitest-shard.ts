// SF74 W23 (speed audit #8): `vitest run --shard=i/n` splits by path hash, so push CI's 8 shards took 141-354 s and the
// slowest one was the run's critical path. This sequencer packs the files by their recorded durations
// (test/durations.json, written by scripts/vitest-durations.mjs from a run's results): heaviest file first onto the
// lightest shard. Every shard computes the same packing from the same file list, so each file runs exactly once. A file
// with no recorded duration counts as the median; with no durations file at all, vitest's hash split is used.
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

export const DURATIONS_FILE = 'test/durations.json';
const FILE_OVERHEAD_S = 0.3;

/** Recorded seconds per test file (repo-relative path), or null when there is no usable file. */
export function readDurations(root: string): Map<string, number> | null {
  const file = resolve(root, DURATIONS_FILE);
  if (!existsSync(file)) return null;
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed === null || typeof parsed !== 'object') return null;
  const out = new Map<string, number>();
  for (const [path, seconds] of Object.entries(parsed)) if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) out.set(path, seconds);
  return out.size > 0 ? out : null;
}

/** Longest-processing-time packing of `paths` into `count` shards: deterministic for the same paths and durations. */
export function packShards(paths: readonly string[], durations: ReadonlyMap<string, number>, count: number): string[][] {
  const known = [...durations.values()].sort((a, b) => a - b);
  const median = known.length > 0 ? known[Math.floor(known.length / 2)] ?? 1 : 1;
  // the recorded duration is the tests' own time; every file also pays its import and collection (~0.3 s under load)
  const weight = (path: string): number => (durations.get(path) ?? median) + FILE_OVERHEAD_S;
  const order = [...paths].sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : a > b ? 1 : 0));
  const shards = Array.from({ length: count }, () => ({ total: 0, paths: [] as string[] }));
  for (const path of order) {
    const lightest = shards.reduce((best, shard) => (shard.total < best.total || (shard.total === best.total && shard.paths.length < best.paths.length) ? shard : best));
    lightest.total += weight(path); lightest.paths.push(path);
  }
  return shards.map((shard) => shard.paths);
}

export class DurationSequencer extends BaseSequencer {
  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    const durations = shard === undefined ? null : readDurations(root);
    if (shard === undefined || durations === null) return super.shard(files);
    const key = (spec: TestSpecification): string => relative(root, spec.moduleId).replaceAll('\\', '/');
    const mine = new Set(packShards([...new Set(files.map(key))], durations, shard.count)[shard.index - 1]);
    return Promise.resolve(files.filter((spec) => mine.has(key(spec))));
  }
}
