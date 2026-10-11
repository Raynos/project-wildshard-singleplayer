// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete cold byte buffers with the native oracle.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare cold source bytes with the committed native terrain oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The generation catalogue belongs to this isolated source root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { Noise2D } from '@wildshard/engine/core/noise';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import manifest from '../src/shards/driftwood-isle/manifest';
import { DriftwoodNoise } from '../src/shards/driftwood-isle/generators/landscapeNoise';
import { driftwoodGroundBytes, driftwoodGroundRows } from '../src/shards/driftwood-isle/generators/groundRows';
import { buildDriftwoodField } from '../src/shards/driftwood-isle/generators/groundField';
import { driftwoodLandscape } from '../src/shards/driftwood-isle/generators/landscape';
import { SEED, SHORE_LEVEL, WORLD_DROP, GRADED, TRAILS } from '../src/shards/driftwood-isle/data/landscapeRows';

it('recompiles all native header, height and splat bytes without a retained grid as input', () => {
  const bytes = driftwoodGroundBytes(), retained = readFileSync('public/assets/baked/driftwood-isle/terrain.bin');
  expect(bytes.byteLength).toBe(524312);
  expect(Buffer.from(bytes).equals(retained)).toBe(true);
  const grid = parseBakedTerrain(Uint8Array.from(bytes).buffer);
  if (grid === null) throw new Error('Cold native ground did not parse');
  expect([grid.res, grid.size, grid.seed, grid.undergrowth]).toEqual([256, 500, SEED, null]);
  expect(Array.from(grid.heights)).toEqual(driftwoodGroundRows().heights);
});

it('preserves 10,000 seeded native simplex and octave samples', () => {
  for (const seed of [SEED, 357, 0, 0xffffffff]) {
    const author = new DriftwoodNoise(seed), native = new Noise2D(seed);
    for (let i = 0; i < 2500; i++) {
      const x = -20 + (i % 50) * 0.81, z = -20 + Math.floor(i / 50) * 0.83;
      expect(author.get(x, z)).toBe(native.get(x, z));
      expect(author.fbm(x, z, 3)).toBe(native.fbm(x, z, 3));
    }
  }
});

it('preserves the native analytic grade, trail, entry and dropped-world field at 10,000 points', () => {
  const author = buildDriftwoodField(SEED, { landscape: driftwoodLandscape, oceanLevel: SHORE_LEVEL,
    graded: GRADED, trails: TRAILS, cabinSites: [] });
  const native = manifest.ground.terrain;
  if (native === undefined) throw new Error('Native Driftwood field missing');
  for (let i = 0; i < 10000; i++) {
    const x = -250 + (i % 100) * 5.019, z = -250 + Math.floor(i / 100) * 5.013;
    expect(author.heightAt(x, z) - WORLD_DROP).toBe(native.heightAt(x, z));
  }
});

it('returns independent cold floor lattices', () => {
  const first = driftwoodGroundRows(), before = JSON.stringify(first);
  first.heights[0] = 999;
  expect(JSON.stringify(driftwoodGroundRows())).toBe(before);
});

it('keys the complete cold ground component from authoring sources, with no retained output seed', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'driftwood-ground');
  if (job === undefined) throw new Error('Missing complete native ground job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'driftwood-isle', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'driftwood-isle') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['public/assets/baked/driftwood-isle/terrain.bin']);
  expect(job.buildOutputs).toEqual({ 'public/assets/baked/driftwood-isle/terrain.bin': '7ee9dec5bd542063dce4c19d70d3e2fe9c3f61b54eff23387c0aec5629346c43' });
  expect(job.outputs).not.toContain('src/shards/driftwood-isle/runtime/navmesh.baked.json');
});
