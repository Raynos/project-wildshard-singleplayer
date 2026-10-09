// SF72: the baked navmesh's query core is renderer-free (src/engine/physics/navmesh.ts; the app binding is navmeshLoad.ts)
// and is the one implementation the browser and the headless runtimes share. The oracle: each shard's navmesh answers
// the recorded creature queries (test/fixtures/navmesh-oracle/source.json, recorded from the browser's module before the
// split) exactly, under vitest and in plain Node with no renderer module loadable (scripts/sim-node-loader.mjs).
// oxlint-disable-next-line import/no-nodejs-modules -- the oracle's second half runs in plain Node, outside Vitest's module graph
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseNavmesh } from '../src/engine/physics/navmesh';
import { ORACLE_SHARDS, oracleQueries, type OracleAnswer } from './fixtures/navmesh-oracle/queries';
import source from './fixtures/navmesh-oracle/source.json';
import driftwoodNav from '../public/assets/baked/driftwood-isle/navmesh.bin?inline';
import pineNav from '../public/assets/baked/pine-hollow/navmesh.bin?inline';

const recorded: Record<string, readonly unknown[]> = source.shards;
const BINS: Record<(typeof ORACLE_SHARDS)[number], string> = { 'driftwood-isle': driftwoodNav, 'pine-hollow': pineNav };
/** the answers as the recording stored them (JSON: a tuple is an array, −0 is 0) */
const asRecorded = (answers: OracleAnswer[]): unknown => { const text = JSON.stringify(answers); return JSON.parse(text); };

describe('SF72 navmesh oracle', () => {
  ORACLE_SHARDS.forEach((slug, i) => {
    it(`${slug}: the recorded paths, wander targets, clear-ahead probes and snaps, exactly`, async () => {
      // a `?inline` import is a data: URL (as test/physics-navmesh.test.ts reads it)
      const nav = parseNavmesh(await (await fetch(BINS[slug])).arrayBuffer());
      expect(nav).not.toBeNull();
      if (nav === null) return;
      const want = recorded[slug] ?? [];
      expect(want.length).toBeGreaterThan(100);
      expect(asRecorded(oracleQueries(nav, 7200 + i))).toEqual(want);
    });
  });

  it('plain Node loads every shard navmesh without the renderer and gives the same answers', () => {
    const out: unknown = JSON.parse(execFileSync('node', ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', 'test/fixtures/navmesh-oracle/replay.mjs'], { encoding: 'utf8', timeout: 60_000 }));
    expect(out).toEqual({
      'driftwood-isle': { layers: [Math.fround(0.3), 0.5], queries: 240, recorded: 240, firstDifference: -1 },
      'pine-hollow': { layers: [0.5], queries: 160, recorded: 160, firstDifference: -1 },
    });
  });
});
