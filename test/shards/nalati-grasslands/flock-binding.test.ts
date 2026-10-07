import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash every real native continuation frame instead of retaining a large trace.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { setting, saveSetting } from '../../../src/engine/ui/Settings';
import { Pack, HorseHerd } from '../../../src/shards/nalati-grasslands/runtime/groupRegistry';
import { Wildlife } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import { createNativeFlocks } from '../../../src/shards/nalati-grasslands/runtime/flockDeclared';
import { wildEnv } from '../../../src/shards/nalati-grasslands/creatures/env';
import { manager } from '../../fake/manager';

const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(terrain);
const packs = Pack.all, herds = HorseHerd.all;
let creatures = setting('creatures');
beforeEach(() => { creatures = setting('creatures'); saveSetting('creatures', 'proc'); });
afterEach(() => { Pack.all = packs; HorseHerd.all = herds; saveSetting('creatures', creatures); });
const layout = { packs: [{ x: 20, z: 0, variants: ['alpha', 'grey', 'scout'] }],
  herds: [{ x: -20, z: 0, mares: 2, foals: 1, stallion: true }], flocks: [{ x: 0, z: 20, count: 8, dog: true }] };
function replay(on: boolean, hz: number): object {
  app.rng.seed(357); Pack.all = []; HorseHerd.all = [];
  const world = manager(), declared = on ? createNativeFlocks(world.sky, 357, layout.flocks) : null;
  const wildlife = new Wildlife(world.manager, { scene: world.game.scene, sky: world.sky, seed: 357, layout,
    ...(declared !== null ? { flock: declared.factory } : {}) }).build();
  const hash = createHash('sha256'), sounds: string[] = [], tramples: number[][] = [];
  const oldTrample = wildEnv.trample;
  wildEnv.trample = (...args) => { tramples.push(args); };
  wildlife.onSound = (cue, position) => { sounds.push(`${cue}.${position.x}.${position.y}.${position.z}`); };
  const player = { position: world.player.position, forward: new Vector3(0, 0, 1), crouching: false };
  try {
    for (let tick = 0; tick < 10000; tick++) {
      player.position.set(tick % 3000 < 1000 ? 0 : tick % 3000 < 2000 ? 100 : 300, 0, tick < 5000 ? 10 : 40);
      player.crouching = tick > 5000;
      if (tick % 1500 === 0) wildlife.scare(0, 0, 100);
      if (tick === 1400) wildlife.flocks[0]?.kill(3);
      if (tick === 500) {
        const pack = wildlife.packs[0], flock = wildlife.flocks[0]; if (pack === undefined || flock === undefined) throw new Error('Missing native groups');
        const prey = flock.prey(2); pack.raid(prey);
        expect(wildlife.resolvePrey(wildlife.preyIdentity(prey))).toBe(prey);
      }
      wildlife.update(1 / hz, tick / hz, player, {}, declared === null ? undefined : (view, index, speed) => {
        declared.advance(view, index, speed, player.position, 1 / hz, tick / hz, declared.runtime.advance);
      });
      world.advance(60 / hz);
      hash.update(JSON.stringify([world.manager.animals.map(actor => actor.snapshot()), app.rng.snapshot(),
        wildlife.flocks.map(view => [view.cx, view.cz, view.alive, view.panicking, view.straggler(),
          [...view.mesh.instanceMatrix.array], [...view.mesh.geometry.getAttribute('iAnim').array], [...(view.mesh.instanceColor?.array ?? [])]]), sounds, tramples]));
      sounds.length = 0; tramples.length = 0;
    }
    return { digest: hash.digest('hex'), rng: app.rng.snapshot() };
  } finally { wildEnv.trample = oldTrample; }
}
describe('Nalati live native declared flock selection', () => {
  it.each([30, 60])('keeps real manager/dog/prey/state/audio/trample output exact for 10k frames at %i Hz', hz => {
    expect(replay(true, hz)).toEqual(replay(false, hz));
  });
});
