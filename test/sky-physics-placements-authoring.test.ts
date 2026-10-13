// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the registered complete authoring job in this isolated tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { skyPhysicsPlacements } from '../src/shards/far-reach/generators/physicsPlacements';
import native from '../src/shards/far-reach/data/physics.generated.json' with { type: 'json' };

it('compiles the exact native island/lip/prop placements without running a world, model or registry constructor', () => {
  const rows = skyPhysicsPlacements(), ids = new Set(rows.map(row => row.id));
  expect(rows).toHaveLength(22);
  expect(rows).toEqual(native.pieces.filter(piece => ids.has(piece.id)));
  // Preserve the existing byte transport's property order as well as its geometry and ownership fields.
  expect(JSON.stringify(rows)).toBe(JSON.stringify(native.pieces.filter(piece => ids.has(piece.id))));
  expect(rows.filter(row => row.category === 'ground')).toHaveLength(12);
  expect(rows.reduce((sum, row) => sum + row.colliders.length, 0)).toBe(89);
  expect(rows.filter(row => row.category === 'ground').every(row => row.colliders.length === 6)).toBe(true);
  expect(rows.filter(row => row.id.startsWith('far.islet.lip.')).map(row => row.id)).toEqual([
    'far.islet.lip.north', 'far.islet.lip.east', 'far.islet.lip.south', 'far.islet.lip.west',
  ]);
});

it('does not retain mutable collider objects between independent cold author runs', () => {
  const first = skyPhysicsPlacements(), before = JSON.stringify(first);
  const shape = first[0]?.colliders[0];
  if (shape?.kind !== 'box') throw new Error('Missing native street slab');
  shape.x = 0; shape.hx = 1;
  expect(JSON.stringify(skyPhysicsPlacements())).toBe(before);
});

it('keys a complete portable component without runtime, legacy, generated seeds or a whole-product removal claim', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-physics-placements');
  if (job === undefined) throw new Error('Missing authored Nine placements job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'far-reach', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, inputs, 'far-reach');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'far-reach') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/far-reach/data/physicsPlacements.generated.json']);
  expect(job.buildOutputs).toEqual({ 'src/shards/far-reach/data/physicsPlacements.generated.json': '12f4de8259d2a8589352afe3229cd9f90f9f4e94d09ba845dcb420f255b849b4' });
  expect(job.outputs).not.toContain('src/shards/far-reach/data/physics.generated.json');
});
