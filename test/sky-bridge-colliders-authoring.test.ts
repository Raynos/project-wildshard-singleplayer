// oxlint-disable-next-line import/no-nodejs-modules -- Inspect this isolated registered author job.
import process from 'node:process';
import { expect, it } from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { deckCollider, railColliders, saggedColliders, skyBridgePhysicsPlacements } from '../src/shards/far-reach/generators/bridgeColliders';
import { SPANS, FALLEN_BRIDGE, UPDRAFT } from '../src/shards/far-reach/data/layout';
import { risingIsletRows } from '../src/shards/far-reach/generators/risingIslets';
import native from '../src/shards/far-reach/runtime/physics.baked.json' with { type: 'json' };

it('compiles eleven bridge rest placements and all 975 boxes with exact persisted native property order', () => {
  const rows = skyBridgePhysicsPlacements(), ids = new Set(rows.map(row => row.id));
  expect(rows).toHaveLength(11);
  expect(rows.reduce((sum, row) => sum + row.colliders.length, 0)).toBe(975);
  expect(JSON.stringify(rows)).toBe(JSON.stringify(native.pieces.filter(piece => ids.has(piece.id))));
  expect(rows.filter(row => row.mode === 'board').map(row => [row.id, row.active])).toEqual([
    ['far.hover.roost', false], ['far.hover.keeper', false], ['far.updraft', false],
  ]);
  expect(rows.find(row => row.id === FALLEN_BRIDGE.id)?.active).toBe(false);
});

it('preserves the shipping quaternion, chord overlap, sagged rail and sloped deck expressions', () => {
  const rows = skyBridgePhysicsPlacements();
  const spans = [...SPANS, ...risingIsletRows().entries.map(entry => entry.bridge)];
  for (const span of spans) {
    const actual = rows.find(row => row.id === span.id), shapes = span.kind === 'hover' ? [deckCollider(span)] : saggedColliders(span);
    expect(JSON.stringify(actual?.colliders), span.id).toBe(JSON.stringify(shapes));
  }
  expect(JSON.stringify(rows.find(row => row.id === 'far.updraft')?.colliders)).toBe(JSON.stringify([deckCollider(UPDRAFT)]));
  expect(JSON.stringify(rows.find(row => row.id === FALLEN_BRIDGE.id)?.colliders)).toBe(JSON.stringify([deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)]));
});

it('does not share mutable colliders across independent cold runs', () => {
  const rows = skyBridgePhysicsPlacements(), bytes = JSON.stringify(rows), box = rows[0]?.colliders[0];
  if (box === undefined) throw new Error('Missing native deck chord');
  box.hy = 999;
  expect(JSON.stringify(skyBridgePhysicsPlacements())).toBe(bytes);
});

it('pins a complete portable component without world/runtime constructors or captured collider seeds', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-bridge-colliders');
  if (job === undefined) throw new Error('Missing bridge collider job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'far-reach', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, inputs, 'far-reach');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'far-reach') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/far-reach/data/bridgePhysics.generated.json']);
  expect(job.buildOutputs).toEqual({ 'src/shards/far-reach/data/bridgePhysics.generated.json': 'd5545bc47278abcf37fbefea7a2fdbad75a8998b684e309a1585da081ce425f7' });
  expect(job.outputs).not.toContain('src/shards/far-reach/runtime/physics.baked.json');
});
