import { afterAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every real-manager continuation frame without retaining a large trace.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { PackBrain } from '../../../src/engine/ai/pack';
import { HerdBrain } from '../../../src/engine/ai/herd';
import { Pack, HorseHerd } from '../../../src/shards/nalati-grasslands/runtime/groupRegistry';
import { Pack as ShippingPack } from '../../fixtures/nalati-group-oracle/pack';
import { HorseHerd as ShippingHorseHerd } from '../../fixtures/nalati-group-oracle/herd';
import { Wildlife } from '../../../src/shards/nalati-grasslands/creatures/wildlife';
import { declaredGroupFactories } from '../../../src/shards/nalati-grasslands/runtime/groupDeclared';
import { manager } from '../../fake/manager';

const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(terrain);
function fixture(on?: boolean): { world: ReturnType<typeof manager>; wildlife: Wildlife } {
  app.rng.seed(357);
  const world = manager(), wildlife = new Wildlife(world.manager, { scene: world.game.scene, sky: world.sky, seed: 357,
    layout: { packs: [{ x: 20, z: 0, variants: ['alpha', 'grey', 'scout'] }],
      herds: [{ x: -20, z: 0, mares: 2, foals: 1, stallion: true }], flocks: [{ x: 0, z: 20, count: 3, dog: false }] } });
  wildlife.build(on === undefined ? undefined : on ? declaredGroupFactories({ preyIdentity: prey => wildlife.preyIdentity(prey), resolvePrey: id => wildlife.resolvePrey(id),
    resolveActor: id => world.manager.animals.find(actor => actor.entityId === id) ?? null }) : { pack: (members, x, z) => { const policy = new ShippingPack(members, x, z); Pack.register(policy); return policy; },
    herd: members => { const policy = new ShippingHorseHerd(members); HorseHerd.register(policy); return policy; } });
  return { world, wildlife };
}
describe('Nalati native world group binding', () => {
  it('uses declared groups by default after G112 retirement, with the witnessed placement and setup draws', () => {
    const selected = fixture(true), actors = selected.world.manager.animals.map(actor => actor.snapshot()), rng = app.rng.snapshot();
    const current = fixture();
    expect(current.wildlife.packs[0]).toBeInstanceOf(PackBrain); expect(current.wildlife.herds[0]).toBeInstanceOf(HerdBrain);
    expect(current.world.manager.animals.map(actor => actor.snapshot())).toEqual(actors); expect(app.rng.snapshot()).toEqual(rng);
    for (const actor of current.wildlife.packs[0]?.members ?? []) expect(Pack.of(actor)).toBe(current.wildlife.packs[0]);
    for (const actor of current.wildlife.herds[0]?.members ?? []) expect(HorseHerd.of(actor)).toBe(current.wildlife.herds[0]);
  });
  it('matches the real AnimalManager species dispatch and native predator/foal observations for 10,000 frames', () => {
    function replay(on?: boolean): { digest: string; random: ReturnType<typeof app.rng.snapshot> } {
      const { world, wildlife } = fixture(on), hash = createHash('sha256');
      const player = { position: world.player.position, forward: new Vector3(0, 0, 1), crouching: false };
      for (let tick = 0; tick < 10000; tick++) {
        if (tick === 600) for (const actor of wildlife.herds[0]?.members ?? []) actor.position.x += 35;
        if (tick === 1200) wildlife.scare(0, 0, 200);
        if (tick === 2400) wildlife.disturb(20, 0);
        world.player.position.set(tick < 4500 ? 0 : 200, 0, tick < 4500 ? 0 : 200);
        wildlife.update(1 / 60, tick / 60, player); world.advance(1);
        hash.update(JSON.stringify([world.manager.animals.map(actor => actor.snapshot()),
          wildlife.packs.map(group => [group.phase, group.awareness, group.homeX, group.homeZ]),
          wildlife.herds.map(group => [group.mode, group.stallionState, group.trust, group.alert, group.cx, group.cz])]));
      }
      return { digest: hash.digest('hex'), random: app.rng.snapshot() };
    }
    const shipping = replay(false);
    expect(replay(true)).toEqual(shipping); expect(replay()).toEqual(shipping);
  });
  it('compares captured shipping controllers and declared policies with identical placement, setup memory and shared RNG', () => {
    const off = fixture(false), actors = off.world.manager.animals.map(actor => actor.snapshot()), rng = app.rng.snapshot();
    expect(off.wildlife.packs[0]).toBeInstanceOf(ShippingPack); expect(off.wildlife.herds[0]).toBeInstanceOf(ShippingHorseHerd);
    const on = fixture(true);
    expect(on.wildlife.packs[0]).toBeInstanceOf(PackBrain); expect(on.wildlife.herds[0]).toBeInstanceOf(HerdBrain);
    expect(on.world.manager.animals.map(actor => actor.snapshot())).toEqual(actors); expect(app.rng.snapshot()).toEqual(rng);
    for (const actor of on.wildlife.packs[0]?.members ?? []) expect(Pack.of(actor)).toBe(on.wildlife.packs[0]);
    for (const actor of on.wildlife.herds[0]?.members ?? []) expect(HorseHerd.of(actor)).toBe(on.wildlife.herds[0]);
  });
  it('binds flock and animal prey to stable world identities and preserves same-world raid identity on restore', () => {
    const { wildlife, world } = fixture(true), pack = wildlife.packs[0], flock = wildlife.flocks[0], actor = world.manager.animals[0];
    if (!(pack instanceof PackBrain) || flock === undefined || actor === undefined) throw new Error('Missing native groups');
    const prey = flock.prey(1); expect(pack.raid(prey)).toBe(true); const saved = pack.snapshot();
    pack.restore(saved); expect(wildlife.resolvePrey(wildlife.preyIdentity(prey))).toBe(prey);
    expect(wildlife.resolvePrey(wildlife.preyIdentity(actor))).toBe(actor);
    expect(wildlife.resolvePrey('sheep:0:3')).toBeNull(); expect(wildlife.resolvePrey('actor:missing')).toBeNull();
  });
});
