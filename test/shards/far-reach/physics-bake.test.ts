// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
import { expect, it } from 'vitest';
import { skyPhysicsInputs } from '../../../scripts/sky-physics-inputs.mjs';
import baked from '../../../src/shards/far-reach/runtime/physics.baked.json';
import { SKY_SPAWNS } from '../../../src/shards/far-reach/data/spawns';
import { Rng } from '../../../src/engine/core/rng';
import source from '../../../src/shards/far-reach/shard.config';
import { skyScaleRanges } from '../../../src/shards/far-reach/runtime/headless';

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
it('reproduces the browser seeds and scales from the creature manager stream: six draws per spawn, in shipping order', () => {
  // AnimalManager: one private Rng(level seed + 31), the level's seed (the shardfile's 6417, not the engine's default) installed
  // before the manager is built; a named variant draws no roll, then scale, rig seed, actor seed, and the brain's timer, fleeUntil
  // and callT. The eight flyers spawn in play (ray, roost rays, wisps, Roc), the five goats on the first fixed step after them.
  expect(source.identity.seed).toBe(6417);
  const rng = new Rng(source.identity.seed + 31), ranges = skyScaleRanges();
  expect(baked.actors.map(actor => actor.id)).toEqual(['far.ray.0', 'far.roost.0', 'far.roost.1', 'far.roost.2', 'far.wisp.0', 'far.wisp.1', 'far.wisp.2', 'far.roc',
    'far.goat.0', 'far.goat.1', 'far.goat.2', 'far.goat.3', 'far.goat.4']);
  for (const actor of baked.actors) {
    const range = ranges.get(actor.spec.kind); if (range === undefined) throw new Error(`no species row for ${actor.spec.kind}`);
    const scale = rng.range(range[0], range[1]); rng.next(); const seed = rng.next(); rng.next(); rng.next(); rng.next();
    expect([actor.id, scale, seed]).toEqual([actor.id, actor.scale, actor.seed]);
  }
});
