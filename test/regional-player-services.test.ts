import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { PlayerHealth } from '../src/engine/combat/health';
import { bindPlayerEffects, EffectService } from '../src/engine/combat/effects/EffectService';
import type { EffectDef } from '../src/engine/combat/effects/types';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { installGridTravellerCombat } from '../src/game/grid/rules';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const poison: EffectDef = { id: 'effect.fixture-poison', tags: ['status.poison'], kind: 'timed', duration: 10,
  period: 1, tickDamage: 2, modifiers: [], stacking: 'none' };

it('lends the same page health/effects across two entries and restores prior frame services', () => {
  const app = new App(), page = app.engineScope.child('page'), region = app.engineScope.child('region');
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const local = new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const effects = new EffectService([poison], page);
  app.registerPlayer(health, page); app.registerEffects(effects, page);
  app.registerPlayer(local, region);
  app.levelScope = region;
  try {
    for (let visit = 0; visit < 2; visit++) {
      const entry = region.child('entered'); app.bindPlayerServices(page, entry);
      expect(app.player).toBe(health); expect(app.effects).toBe(effects);
      entry.dispose(); expect(app.player).toBe(local); expect(app.effects).toBeNull();
      expect(app.systemIds(page).filter(id => id === 'engine.effects')).toHaveLength(1);
    }
    expect(page.disposed).toBe(false);
  } finally { app.engineScope.dispose(); }
});

it('adopts kit effects atomically and keeps one periodic-damage binding for the carried player', () => {
  const app = new App(), page = new Scope('page'), entry = page.child('regional');
  const effects = new EffectService([poison], page, app.events);
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  app.combat.playerRules(page, { target: health });
  const movement = { effectMoveLocked: false, effectMoveScale: 1 };
  const ports = { effects, target: health, movement, combat: app.combat, position: () => new Vector3() };
  const buff: EffectDef = { id: 'effect.fixture-buff', tags: ['buff.speed'], kind: 'timed', duration: 10,
    modifiers: [{ attr: 'moveSpeedMul', op: 'mul', value: 1.2 }], stacking: 'none' };
  try {
    bindPlayerEffects({ ...ports, scope: page }); bindPlayerEffects({ ...ports, scope: entry });
    effects.registerDefinitions([{ ...poison }, buff]);
    const rejected: EffectDef = { ...buff, id: 'effect.fixture-refused' };
    expect(() => effects.registerDefinitions([rejected, { ...poison, tickDamage: 99 }])).toThrow('Conflicting');
    expect(() => effects.apply(health, rejected.id)).toThrow('Unknown');
    effects.apply(health, poison.id); effects.apply(health, buff.id);
    const hp = health.attributes.health;
    effects.update(1); expect(health.attributes.health).toBe(hp - 2); expect(movement.effectMoveScale).toBe(1.2);
    entry.dispose(); effects.update(1); expect(health.attributes.health).toBe(hp - 4); expect(movement.effectMoveScale).toBe(1.2);
  } finally { page.dispose(); app.engineScope.dispose(); }
});

it('follows the entered runtime while refusing the road and parked actors with repeated IDs', () => {
  const app = new App(), scope = app.engineScope.child('combat');
  const traveller = new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const row = SIM_LEVEL.entities[0]; if (row === undefined) throw new Error('Missing actual creature');
  const active = new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: () => 0, random: () => 0.5 });
  const parked = new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: () => 0, random: () => 0.5 });
  let inside: string | null = 'regional', entered: string | null = 'regional';
  const actors = new Map([[active.combatActor(), active.position]]);
  installGridTravellerCombat(app.events, scope, traveller, () => entered, () => inside, () => actors);
  const hit = (target: AnimalSim) => app.combat.hit({ source: traveller, sourceTags: ['cover.checked'],
    target: target.combatActor(), amount: 1, point: target.position, dir: new Vector3() });
  try {
    expect(hit(active)?.dealt).toBe(1); expect(hit(parked)).toBeNull();
    inside = null; expect(hit(active)).toBeNull();
    inside = 'regional'; entered = null; expect(hit(active)).toBeNull();
    entered = 'regional'; expect(hit(active)?.dealt).toBe(1);
  } finally { app.engineScope.dispose(); }
});
