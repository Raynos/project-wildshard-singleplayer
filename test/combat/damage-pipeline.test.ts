import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { app } from '#engine/app/runtime';
import { damageFor } from '#engine/entities/Animal';
import { Crossbow, type TargetHit } from '#engine/player/Crossbow';
import { Projectiles } from '#engine/player/Projectiles';
import { boltDamage } from '#shards/pine-hollow/loadout/ammo';
import { legacyActor, invokeLegacy, damageTarget } from '../fake/legacyActor';
import { legacyHurtFixture } from '../fake/legacyHurt';
import { fakeWorld } from '../fake/world';

const attacker = (kind = 'boar') => ({ kind, label: kind, position: new THREE.Vector3(2, 0, 0) });
describe('current executable damage rules (09 §3.6)', () => {
  it('cap, captain exemption and dodge guard apply in today’s order', () => {
    const f = legacyHurtFixture();
    f.api.creature(attacker(), 25); expect(f.api.health).toBe(80);
    f.api.creature(attacker('captain'), 40); expect(f.api.health).toBe(40);
    const guard = legacyHurtFixture({ tusk: true, guarded: true });
    guard.api.creature(attacker(), 80); expect(guard.api.health).toBe(100);
    expect(guard.audio.hurt).not.toHaveBeenCalled(); expect(guard.api.lastHurt).toBe(0);
    guard.player.dodging = false; guard.api.creature(attacker(), 80); expect(guard.api.health).toBe(80);
    const bare = legacyHurtFixture({ guarded: true });
    bare.api.creature(attacker(), 25); expect(bare.api.health).toBe(80);
  });
  it('death fade vetoes creature hits before guard/cap and restores environmental damage at the next tick', () => {
    const f = legacyHurtFixture(); f.deathFade.active = true;
    f.api.creature(attacker(), 50); expect(f.api.health).toBe(100); expect(f.hud.damageFlash).not.toHaveBeenCalled();
    f.api.lightning(60, 'lightning'); expect(f.api.health).toBe(40);
    f.game.advance(1 / 60); expect(f.api.health).toBe(100); expect(f.audio.death).not.toHaveBeenCalled();
  });
  it('regeneration starts strictly after 6 seconds, adds 4/s, and clamps at max health', () => {
    const f = legacyHurtFixture(); f.api.creature(attacker(), 20);
    f.clock.now = 7000; f.game.advance(0.1); expect(f.api.health).toBe(80);
    f.clock.now = 7001; f.game.advance(0.1); expect(f.api.health).toBeCloseTo(80.4);
    f.api.healthSet(99.8); f.game.advance(0.1); expect(f.api.health).toBe(100);
  });
  it('fall damage leaves the regen clock alone and a lethal fall clears the previous killer', () => {
    const f = legacyHurtFixture(); f.api.creature(attacker(), 20); f.clock.now = 8000;
    f.api.fall(true); expect(f.api.lastHurt).toBe(1000);
    f.game.advance(0.1); expect(f.api.health).toBeCloseTo(72.4);
    f.api.healthSet(7); f.api.fall(true); expect(f.api.health).toBe(0); expect(f.api.killer).toBeNull();
  });
  it.each([false, true])('death checkpoint answer %s controls the normal respawn and always refills ammo', (checkpoint) => {
    const f = legacyHurtFixture(); f.encounter.onPlayerDeath.mockReturnValue(checkpoint);
    f.api.healthSet(8); f.api.creature(attacker(), 20); f.game.advance(1 / 60);
    expect(f.api.health).toBe(100); expect(f.audio.death).toHaveBeenCalledOnce();
    expect(f.encounter.onPlayerDeath).toHaveBeenCalledOnce();
    expect(f.die).toHaveBeenCalledTimes(checkpoint ? 0 : 1);
    if (!checkpoint) expect(f.die).toHaveBeenCalledWith({ kind: 'boar', label: 'boar' });
    expect(f.crossbow.addBolts).toHaveBeenCalledWith(18); expect(f.refill).toHaveBeenCalledTimes(2);
    expect(f.api.killer).toBeNull();
  });
  it('seeded gameplay damageFor gives identical 20 rolls and preserves body/head distance falloff (B5)', () => {
    const sequence = (): number[] => { app.rng.seed(42); return Array.from({ length: 20 }, () => damageFor(false, 20)); };
    const rolls = sequence(); expect(sequence()).toEqual(rolls);
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(32); expect(Math.max(...rolls)).toBeLessThanOrEqual(40);
    for (const [head, distance, expected] of [[false, 20, 36], [true, 20, 90], [false, 65, 29], [true, 90, 54]] as const) {
      const draw = vi.spyOn(app.rng.stream('gameplay'), 'next').mockReturnValue(0.5);
      try { expect(damageFor(head, distance)).toBe(expected); } finally { draw.mockRestore(); }
    }
  });
  it('variant shrug rounds before the species rule and a headshot skips only the variant shrug', () => {
    const { animal, body, head, dealt } = damageTarget({ bodyMul: 0.6, speciesMul: 1.25 });
    animal.applyDamage(37, body, new THREE.Vector3(0, 0, -1));
    animal.applyDamage(37, head, new THREE.Vector3(0, 0, -1));
    expect(dealt).toEqual([28, 46]); expect(animal.hp).toBe(100000 - 28 - 46);
  });
  it('sneak arrow multiplication rounds once before variant/species rules and is never overwritten', () => {
    const target = damageTarget({ bodyMul: 0.6, speciesMul: 1.25 }), world = fakeWorld();
    const hit: TargetHit = { animal: target.animal, point: target.body, distance: 20, headshot: false };
    const pool = legacyActor(Projectiles.prototype, { kind: {}, targets: { raycast: () => hit }, onHit: undefined, stop: () => undefined });
    const flying = { pos: new THREE.Vector3(0, 0.8, -1), origin: new THREE.Vector3(), scale: 1.2, hitScale: () => 2 };
    expect(invokeLegacy(pool, 'testHit', flying, new THREE.Vector3(0, 0.8, 0))).toBe(true);
    expect(target.dealt).toEqual([66]); // round(37*1.2*2)=89 → round(89*.6)=53 → round(53*1.25)=66
    expect(world.game.dead).toBe(false);
  });
  it('broadhead product stays unrounded until the real applyDamage rules run', () => {
    const target = damageTarget({ bodyMul: 0.6, speciesMul: 1.25 }), world = fakeWorld();
    const hit: TargetHit = { animal: target.animal, point: target.body, distance: 20, headshot: false };
    const bolt = legacyActor(Crossbow.prototype, { targets: { raycast: () => hit }, game: world.game.asGame(), onHit: undefined, stopBolt: () => undefined });
    const b = { pos: new THREE.Vector3(0, 0.8, -1), mod: { damage: (kind: string) => boltDamage('broadhead', kind) } };
    expect(invokeLegacy(bolt, 'testHit', b, new THREE.Vector3(0, 0.8, 0))).toBe(true);
    expect(target.dealt).toEqual([39]); // 37*1.4=51.8 → round(*.6)=31 → round(*1.25)=39
  });
});
