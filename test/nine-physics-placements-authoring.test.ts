// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the registered complete authoring job in this isolated tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { ninePhysicsPlacements } from '../src/shards/nine-dragon-stack/generators/physicsPlacements';
import native from '../src/shards/nine-dragon-stack/runtime/physics.baked.json' with { type: 'json' };

it('compiles the exact eight native placements without running a world, model or registry constructor', () => {
  const rows = ninePhysicsPlacements(), ids = new Set(rows.map(row => row.id));
  expect(rows).toHaveLength(8);
  expect(rows).toEqual(native.pieces.filter(piece => ids.has(piece.id)));
  // Preserve the existing byte transport's property order as well as its geometry and ownership fields.
  expect(JSON.stringify(rows)).toBe(JSON.stringify(native.pieces.filter(piece => ids.has(piece.id))));
  const floors = rows.find(row => row.id === 'nds-floors');
  expect(floors?.colliders.filter(shape => shape.kind === 'treads')).toHaveLength(3);
  expect(floors?.colliders).toHaveLength(28);
  expect(rows.find(row => row.id === 'nds-grapple-guard')?.follows).toEqual({
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], rotation: true,
  });
});

it('does not retain mutable collider objects between independent cold author runs', () => {
  const first = ninePhysicsPlacements(), before = JSON.stringify(first);
  const shape = first[0]?.colliders[0];
  if (shape?.kind !== 'box') throw new Error('Missing native street slab');
  shape.x = 0; shape.hx = 1;
  expect(JSON.stringify(ninePhysicsPlacements())).toBe(before);
});

it('keys a complete portable component without runtime, legacy, generated seeds or a whole-product removal claim', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-physics-placements');
  if (job === undefined) throw new Error('Missing authored Nine placements job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'nine-dragon-stack', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, inputs, 'nine-dragon-stack');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'nine-dragon-stack') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/nine-dragon-stack/data/physicsPlacements.generated.json']);
  expect(job.buildOutputs).toEqual({ 'src/shards/nine-dragon-stack/data/physicsPlacements.generated.json': '044b4d71b4a17d42afbcce23672ac51fb97e2e9ece0c205d31a0fd855fd9606d' });
  expect(job.outputs).not.toContain('src/shards/nine-dragon-stack/runtime/physics.baked.json');
});
