// oxlint-disable-next-line import/no-nodejs-modules -- Trusted-bake freshness is checked against the test checkout.
import process from 'node:process';
import { expect, it } from 'vitest';
import { signalPhysicsInputs } from '../../../scripts/signal-physics-inputs.mjs';
import baked from '../../../src/shards/sunscar-dunes/runtime/physics.baked.json';
import { SIGNAL_SPAWNS } from '../../../src/shards/sunscar-dunes/data/spawns';
import { Rng } from '../../../src/engine/core/rng';
import { SEED } from '../../../src/shards/sunscar-dunes/data/layout';
import { DUNE_RAY } from '../../../src/shards/sunscar-dunes/runtime/species/duneRay';
import { DUNE_STRIDER } from '../../../src/shards/sunscar-dunes/runtime/species/strider';
import { SKITTERER_DATA } from '../../../src/shards/sunscar-dunes/runtime/species/skitterer';
import { MATRIARCH_DATA } from '../../../src/shards/sunscar-dunes/runtime/species/matriarch';

it('refuses stale source or model bytes before the trusted Signal physics bake is used', () => {
  expect(baked.version).toBe(1);
  expect(baked.inputs).toEqual(signalPhysicsInputs(process.cwd()));
  expect(baked.revision).toMatch(/^[a-f0-9]{40}$/u);
  expect(Object.keys(baked.inputs).some(path => path.endsWith('/dune-strider.glb'))).toBe(true);
  expect(Object.keys(baked.inputs)).toContain('src/shards/sunscar-dunes/world/build.ts');
});

it('captures the 13 declared homes in order, the Matriarch and the native colliders', () => {
  expect(baked.actors.map(actor => [actor.id, actor.kind])).toEqual(SIGNAL_SPAWNS.homes.map(home => [home.id, home.kind]));
  expect(baked.bosses.map(boss => [boss.id, boss.kind])).toEqual(SIGNAL_SPAWNS.bosses.map(boss => [boss.id, boss.kind]));
  for (const actor of [...baked.actors, ...baked.bosses]) { expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0); }
  // the strider's height is its fitted generated model's, not the code body's 2.8 m fallback
  const strider = baked.actors.find(actor => actor.kind === 'duneStrider');
  expect(strider?.spec.dims.bodyY).not.toBeCloseTo(2.8 * 0.7, 6);
  for (const id of ['sunscar.tower', 'sunscar.well', 'sunscar.caravan', 'sunscar.rocks', 'sunscar.brazier.0', 'sunscar.brazier.1', 'sunscar.brazier.2'])
    expect(baked.pieces.find(piece => piece.id === id)?.colliders.length).toBeGreaterThan(0);
});

it('reproduces the browser seeds and scales from the creature manager stream: six draws per spawn, in home order', () => {
  // AnimalManager: one private Rng(level SEED + 31), the level's seed (5363) installed before the manager is built; a named variant draws no roll, then scale, rig seed, actor seed, and the
  // brain's timer, fleeUntil and callT. A headless keeper owning this stream reproduces every first spawn exactly.
  const rng = new Rng(SEED + 31), ranges = new Map<string, readonly [number, number]>();
  for (const row of [DUNE_RAY, SKITTERER_DATA, DUNE_STRIDER, MATRIARCH_DATA]) {
    const variant = row.variants[0]; if (variant === undefined) throw new Error('species without variant');
    ranges.set(row.kind, variant.scale);
  }
  for (const actor of baked.actors) {
    const range = ranges.get(actor.kind); if (range === undefined) throw new Error(`no species row for ${actor.kind}`);
    const scale = rng.range(range[0], range[1]); rng.next(); const seed = rng.next(); rng.next(); rng.next(); rng.next();
    expect([actor.id, scale, seed]).toEqual([actor.id, actor.scale, actor.seed]);
  }
});
