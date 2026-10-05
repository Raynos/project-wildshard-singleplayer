import { CROSSBOW_PROFILE } from '../../src/shards/pine-hollow/weapons/crossbow/profiles';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { damageFor } from '../../src/engine/entities/AnimalView';
import { Crossbow } from '../../src/shards/pine-hollow/weapons/crossbow/Crossbow';
import type { TargetHit } from '../../src/engine/combat/types';
import { Projectiles } from '../../src/engine/combat/view/projectile';
import { boltDamage } from '../../src/shards/pine-hollow/loadout/ammo';
import { legacyActor, invokeLegacy, damageTarget } from '../fake/legacyActor';
import { legacyHurtFixture } from '../fake/legacyHurt';
import { fakeWorld } from '../fake/world';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import type { Actor, CombatTag, DamageRequest, DamageDealt } from '../../src/engine/combat/pipeline';

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
  it('death fade vetoes every hit before rules and feedback (R0)', () => {
    const f = legacyHurtFixture(); f.deathFade.active = true;
    f.api.creature(attacker(), 50); expect(f.api.health).toBe(100); expect(f.hud.damageFlash).not.toHaveBeenCalled();
    f.api.lightning(60, 'lightning'); expect(f.api.health).toBe(100); expect(f.audio.land).not.toHaveBeenCalled();
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
    const pool = legacyActor(Projectiles.prototype, { kind: {}, onTargetHit: undefined, targets: { raycast: () => hit }, onHit: undefined, stop: () => undefined });
    const flying = { pos: new THREE.Vector3(0, 0.8, -1), origin: new THREE.Vector3(), scale: 1.2, hitScale: () => 2 };
    expect(invokeLegacy(pool, 'testHit', flying, new THREE.Vector3(0, 0.8, 0))).toBe(true);
    expect(target.dealt).toEqual([66]); // round(37*1.2*2)=89 → round(89*.6)=53 → round(53*1.25)=66
    expect(world.game.dead).toBe(false);
  });
  it('broadhead product stays unrounded until the real applyDamage rules run', () => {
    const target = damageTarget({ bodyMul: 0.6, speciesMul: 1.25 }), world = fakeWorld();
    const hit: TargetHit = { animal: target.animal, point: target.body, distance: 20, headshot: false };
    const bolt = legacyActor(Crossbow.prototype, { onBoltHit: () => undefined, profile: CROSSBOW_PROFILE, player: world.player, targets: { raycast: () => hit }, game: world.game.asGame(), onHit: undefined, stopBolt: () => undefined });
    const b = { pos: new THREE.Vector3(0, 0.8, -1), mod: { damage: (kind: string) => boltDamage('broadhead', kind) } };
    expect(invokeLegacy(bolt, 'testHit', b, new THREE.Vector3(0, 0.8, 0))).toBe(true);
    expect(target.dealt).toEqual([39]); // 37*1.4=51.8 → round(*.6)=31 → round(*1.25)=39
  });
});

describe('public combat.hit rules, events and player health', () => {
  const request = (f: ReturnType<typeof legacyHurtFixture>, tags: readonly CombatTag[], amount: number): DamageRequest => ({
    source: 'env', sourceTags: tags, target: f.health, amount, point: new THREE.Vector3(2, 0, 0), dir: new THREE.Vector3(),
  });
  it('R0b vetoes boss/elite/add damage before the cap, while a creature and a fall remain live', () => {
    const f = legacyHurtFixture({ bossGod: true });
    for (const source of ['boss.storm-titan', 'elite.blackpaw', 'add.thrall'] as const) {
      expect(f.combat.hit(request(f, [source], 40))).toBeNull();
    }
    expect(f.api.health).toBe(100); expect(f.api.lastHurt).toBe(0);
    expect(f.combat.hit(request(f, ['creature.boar'], 25))?.dealt).toBe(20);
    expect(f.combat.hit(request(f, ['env.fall'], 8))?.dealt).toBe(8); expect(f.api.health).toBe(72);
  });
  it('B3: every Titan adapter hit obeys the cap and dodge guard', () => {
    const f = legacyHurtFixture({ tusk: true });
    expect(f.combat.hit(request(f, ['boss.storm-titan'], 40))?.dealt).toBe(20);
    f.player.dodging = true;
    expect(f.combat.hit(request(f, ['boss.storm-titan'], 40))).toBeNull();
    expect(f.combat.hit(request(f, ['env.lightning'], 60))?.dealt).toBe(60);
    f.api.healthSet(100); f.api.titan(40); expect(f.api.health).toBe(100);
    f.player.dodging = false; f.api.titan(40); expect(f.api.health).toBe(80);
  });
  it.each([[false, 39], [true, 65]] as const)('R8 then R7 apply only once to a broadhead product, head=%s', (headshot, expected) => {
    const f = legacyHurtFixture(), target = damageTarget({ bodyMul: 0.6, speciesMul: 1.25 });
    const result = f.combat.hit({ ...request(f, ['dmg.ranged', 'ammo.broadhead'], 37 * 1.4),
      target: target.animal.combatActor(), point: headshot ? target.head : target.body, headshot });
    expect(result?.dealt).toBe(expected); expect(target.dealt).toEqual([expected]);
  });
  it('source actor tags/state join request tags before the ordered asks', () => {
    const f = legacyHurtFixture({ tusk: true, guarded: true });
    const source: Actor = { id: 'boss.test', tags: ['boss.test'], state: ['state.enraged'],
      attributes: { health: 100, maxHealth: 100 }, alive: true, applyDamage: () => false };
    expect(f.combat.hit({ ...request(f, ['dmg.melee'], 40), source })).toBeNull();
    f.player.dodging = false;
    expect(f.combat.hit({ ...request(f, ['dmg.melee'], 40), source })?.req.sourceTags).toEqual(['dmg.melee', 'boss.test', 'state.enraged']);
  });
  it('damage/death events are queued in order; a veto and a dead target produce none', () => {
    const f = legacyHurtFixture(), log: string[] = [];
    f.events.on('damage.dealt', (event) => { log.push(`damage:${event.dealt}`); }, f.scope);
    f.events.on('actor.died', () => { log.push('actor.died'); }, f.scope);
    f.events.on('player.died', () => { log.push('player.died'); }, f.scope);
    f.events.on('player.respawned', () => { log.push('player.respawned'); }, f.scope);
    f.api.healthSet(10);
    const hit = request(f, ['creature.boar'], 25);
    expect(f.combat.hit(hit)?.killed).toBe(true); expect(log).toEqual([]);
    expect(f.combat.hit(hit)).toBeNull();
    f.health.update(1 / 60); expect(log).toEqual([]);
    f.events.flush('update'); expect(log).toEqual(['damage:20', 'actor.died', 'player.died', 'player.respawned']);
  });
  it('a health gain/shrink preserves the old max-health arithmetic', () => {
    const f = legacyHurtFixture(); f.api.healthSet(70);
    f.health.setMaxHealth(120); expect(f.api.health).toBe(90);
    f.health.setMaxHealth(80); expect(f.api.health).toBe(80);
    f.health.setMaxHealth(100); expect(f.api.health).toBe(100);
  });
  it('resident player rules filter target identity and disposal releases the answerers/subscribers', () => {
    const a = new App(), f = legacyHurtFixture(), g = legacyHurtFixture({ cap: 50 });
    const s1 = new Scope('first'), s2 = new Scope('second');
    a.registerPlayer(f.health, s1); a.registerPlayer(g.health, s2);
    a.combat.playerRules(s1, { target: f.health }); a.combat.playerRules(s2, { target: g.health });
    const retained = a.events.census();
    const nested = s2.child('nested');
    a.events.on('damage.dealt', () => undefined, nested);
    const outside = a.events.census(s2);
    expect(outside).toEqual({ listeners: 0, answerers: retained.answerers - 2 });
    a.levelScope = s1; expect(a.player).toBe(f.health);
    a.levelScope = s2; expect(a.player).toBe(g.health);
    expect(a.combat.hit(request(g, ['creature.boar'], 40))?.dealt).toBe(40);
    const before = a.events.census().answerers; s2.dispose(); expect(a.player).toBeNull();
    expect(a.events.census().answerers).toBe(before - 2);
    expect(a.events.census()).toEqual(outside);
    f.scope.dispose(); expect(f.events.census()).toEqual({ listeners: 0, answerers: 0 });
  });
  it('ordered simple rows can veto or modify without mutating the source request', () => {
    const f = legacyHurtFixture(), seen: DamageDealt[] = [];
    f.events.on('damage.dealt', (event) => { seen.push(event); }, f.scope);
    f.combat.rule({ id: 'rule.test', order: 20, when: { sourceTags: ['env.test'] }, op: 'mul', value: 2 }, f.scope);
    const req = request(f, ['env.test'], 7);
    expect(f.combat.hit(req)?.dealt).toBe(14); expect(req.amount).toBe(7);
    f.events.flush('update'); expect(seen).toHaveLength(1);
    f.combat.rule({ id: 'rule.veto', order: 21, when: { sourceTags: ['env.test'] }, op: 'negate', value: 0 }, f.scope);
    expect(f.combat.hit(req)).toBeNull(); f.events.flush('update'); expect(seen).toHaveLength(1);
  });
  it('queued damage retains the hit frame when a weapon reuses its raycast scratch vectors', () => {
    const f = legacyHurtFixture(), seen: DamageDealt[] = [];
    f.events.on('damage.dealt', (event) => { seen.push(event); }, f.scope);
    const req = { ...request(f, ['env.test'], 7), from: new THREE.Vector3(3, 4, 5) };
    f.combat.hit(req);
    req.point.set(100, 100, 100); req.dir.set(1, 0, 0); req.from.set(0, 0, 0);
    f.events.flush('update');
    expect(seen[0]?.req.point.toArray()).toEqual([2, 0, 0]);
    expect(seen[0]?.req.dir.toArray()).toEqual([0, 0, 0]);
    expect(seen[0]?.req.from?.toArray()).toEqual([3, 4, 5]);
  });
});
