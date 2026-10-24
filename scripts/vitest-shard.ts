// SF74 W23 (speed audit #8): `vitest run --shard=i/n` splits by path hash, so push CI's 8 shards took 141-354 s and the
// slowest one was the run's critical path. This sequencer packs the files by their recorded durations
// (test/durations.json, written by scripts/vitest-durations.mjs from a run's results): heaviest file first onto the
// lightest shard. Every shard computes the same packing from the same file list, so each file runs exactly once. A file
// with no recorded duration counts as the median; with no durations file at all, vitest's hash split is used.
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import * as v from 'valibot';

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
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root } = this.ctx.config;
    const registry = resolve(root, 'scripts/test-products.json');
    if (existsSync(registry)) {
      const selected = files.map(spec => relative(root, spec.moduleId).replaceAll('\\', '/'));
      const products = v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync(registry, 'utf8')));
      // Pure suites must not load the product reader's native image dependencies.
      if (selected.some(file => (products[file]?.length ?? 0) > 0)) {
        const { assertBuiltTestProducts,selectBuiltTestProducts } = await import('./built-product.mjs');
        const {CI:ci,GITHUB_ACTIONS:actions}=process.env;
        // Only local dependency walks may defer unavailable product suites.
        // Explicit file runs and CI retain the original strict preflight.
        if((this.ctx.config.related?.length??0)>0&&!ci&&!actions){
          const selection=selectBuiltTestProducts(root,selected);
          if(selection.blocked.length>0){
            console.warn(`Local related: skipping ${selection.blocked.length} product suites (CI still runs them): ${selection.blocked.join(', ')}. Missing current products: ${selection.missing.join(', ')}. Build: python3 scripts/heavy-lane.py build -- ${selection.buildCommand}`);
            if(selection.ready.length===0)throw new Error('No runnable related suites; build the named products first');
            const ready=new Set(selection.ready);
            return super.sort(files.filter(spec=>ready.has(relative(root,spec.moduleId).replaceAll('\\','/'))));
          }
          return super.sort(files);
        }
        assertBuiltTestProducts(root, selected);
      }
    }
    return super.sort(files);
  }
  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    const durations = shard === undefined ? null : readDurations(root);
    if (shard === undefined || durations === null) return super.shard(files);
    const key = (spec: TestSpecification): string => relative(root, spec.moduleId).replaceAll('\\', '/');
    const mine = new Set(packShards([...new Set(files.map(key))], durations, shard.count)[shard.index - 1]);
    return Promise.resolve(files.filter((spec) => mine.has(key(spec))));
  }
}
