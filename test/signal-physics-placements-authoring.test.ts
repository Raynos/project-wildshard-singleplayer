// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the registered complete authoring job in this isolated tree.
import process from 'node:process';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { duneHeight } from '../src/shards/sunscar-dunes/world/dunes';
import { TRAIL } from '../src/shards/sunscar-dunes/data/layout';
import { signalHeightAt } from '../src/shards/sunscar-dunes/generators/landscape';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { signalPhysicsPlacements } from '../src/shards/sunscar-dunes/generators/physicsPlacements';
import native from '../src/shards/sunscar-dunes/runtime/physics.baked.json' with { type: 'json' };

it('compiles the exact five native camp placements without running a world, model or registry constructor', () => {
  const rows = signalPhysicsPlacements(), ids = new Set(rows.map(row => row.id));
  expect(rows[0]?.colliders[1]?.surface).toBe('flesh');
  expect(rows).toHaveLength(5);
  // The persisted transport normalizes native negative zero and preserves property order.
  expect(JSON.stringify(rows)).toBe(JSON.stringify(native.pieces.filter(piece => ids.has(piece.id))));
  expect(rows.reduce((sum, row) => sum + row.colliders.length, 0)).toBe(25);
  expect(rows.map(row => row.id)).toEqual(['sunscar.caravan', 'sunscar.well', 'sunscar.brazier.0', 'sunscar.brazier.1', 'sunscar.brazier.2']);
});

it('does not retain mutable collider objects between independent cold author runs', () => {
  const first = signalPhysicsPlacements(), before = JSON.stringify(first);
  const shape = first[0]?.colliders[0];
  if (shape?.kind !== 'box') throw new Error('Missing native street slab');
  shape.x = 0; shape.hx = 1;
  expect(JSON.stringify(signalPhysicsPlacements())).toBe(before);
});

it('keys a complete portable component without runtime, legacy, generated seeds or a whole-product removal claim', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-physics-placements');
  if (job === undefined) throw new Error('Missing authored Signal placements job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'sunscar-dunes') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/sunscar-dunes/data/physicsPlacements.generated.json']);
  expect(job.buildOutputs).toEqual({ 'src/shards/sunscar-dunes/data/physicsPlacements.generated.json': 'dc53caf1683fea1aa8e0117b93485ef09e6956fbd55b29846f0783e5ee8bd92f' });
  expect(job.outputs).not.toContain('src/shards/sunscar-dunes/runtime/physics.baked.json');
});

it('retains every native noise/dune/trail/entry arithmetic step across 10,000 authored terrain samples', () => {
  for (const seed of [5363, 357, 0, 0xffffffff]) {
    const nativeHeight = buildTerrain(seed, { landscape: duneHeight, trails: TRAIL, cabinSites: [] }).heightAt;
    const authorHeight = signalHeightAt(seed);
    for (let index = 0; index < 2500; index++) {
      const x = -250 + (index % 50) * 10.01, z = -250 + Math.floor(index / 50) * 10.01;
      expect(authorHeight(x, z)).toBe(nativeHeight(x, z));
    }
  }
});
