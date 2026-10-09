// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
import { expect, it } from 'vitest';
import { skyPhysicsInputs } from '../../../scripts/sky-physics-inputs.mjs';
import baked from '../../../src/shards/far-reach/runtime/physics.baked.json';
import { SKY_SPAWNS } from '../../../src/shards/far-reach/data/spawns';

it('refuses stale source or model bytes before the trusted Sky physics bake is used', () => {
  expect(baked.version).toBe(1);
  expect(baked.inputs).toEqual(skyPhysicsInputs(process.cwd()));
  expect(baked.revision).toMatch(/^[a-f0-9]{40}$/u);
  expect(Object.keys(baked.inputs).some(path => path.endsWith('/roc-hd.glb'))).toBe(true);
  expect(Object.keys(baked.inputs).some(path => path.endsWith('/sky-goat.glb'))).toBe(true);
});
it('captures every declared finite actor and the actual layered native world, including disabled traversal', () => {
  expect(baked.actors.map(actor => actor.id).sort()).toEqual([...SKY_SPAWNS.actors, ...SKY_SPAWNS.bosses].map(actor => actor.id).sort());
  expect(new Set(baked.actors.map(actor => actor.id)).size).toBe(13);
  for (const actor of baked.actors) {
    expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0);
    expect(Number.isFinite(actor.seed)).toBe(true); expect(actor.scale).toBeGreaterThan(0);
  }
  expect(baked.pieces.filter(piece => piece.id.startsWith('far.isle.'))).toHaveLength(12);
  expect(baked.pieces.find(piece => piece.id === 'far.bridge.crown')?.active).toBe(false);
  expect(baked.pieces.find(piece => piece.id === 'far.updraft')?.active).toBe(false);
  expect(baked.pieces.some(piece => piece.colliders.some(collider => collider.kind === 'hull'))).toBe(true);
});
