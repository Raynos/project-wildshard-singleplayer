import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline, type DamageRequest } from '../src/engine/combat/pipeline';
import { PlayerHealth } from '../src/engine/combat/health';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { GridAssembly } from '../src/game/grid/assembly';
import { installGridTravellerCombat } from '../src/game/grid/rules';
import { SIM_LEVEL } from './fixtures/sim-level/level';

function creature() {
  const row = SIM_LEVEL.entities[0];
  if (row === undefined) throw new Error('Missing actual species');
  return new AnimalSim(row.spec, 357, 1, 'same.entity', { heightAt: () => 0, random: () => 0.5 });
}
function open(regional = false) {
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const scope = new Scope('geometric.combat'), events = new Events(), combat = new CombatPipeline(events, scope);
  const feet = new Vector3(), player = new PlayerHealth(events, { now: () => 1000, position: () => feet, dodging: () => false, dodgeGuard: () => false });
  const animal = creature(), actor = animal.combatActor(), reaction = vi.fn<() => void>(), modified = vi.fn(), dealt = vi.fn();
  actor.onDamageRequest = reaction;
  events.answer('damage.modify', request => { modified(); return request; }, scope);
  events.on('damage.dealt', value => { dealt(value); }, scope);
  installGridTravellerCombat(events, scope, player, home.instance, () => assembly.at(feet.x, feet.z)?.instance ?? null,
    regional ? new Map([[actor, animal.position]]) : undefined);
  const hit = (source: DamageRequest['source'], target: DamageRequest['target'], sourceTags: DamageRequest['sourceTags'] = []) => {
    const result = combat.hit({ source, target, sourceTags, amount: 1, point: feet, dir: new Vector3(1, 0, 0), knockback: 10 });
    if (result !== null && target === actor) animal.impulse(new Vector3(10, 0, 0)); // Weapon contact applies impulse only after admission.
    events.flush('fixed.post');
    return result;
  };
  return { scope, events, combat, feet, player, animal, actor, reaction, modified, dealt, hit };
}

it('uses the geometric edge on all four sides throughout both frame-hysteresis bands', () => {
  for (const regional of [false, true]) {
    const f = open(regional);
    try {
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        for (const distance of [250.01, ...Array.from({ length: 10 }, (_, i) => 251 + i), 270, 277.5]) {
          f.feet.set(x * distance, 0, z * distance);
          const hp = [f.player.attributes.health, f.animal.hp];
          expect(f.hit(f.actor, f.player)).toBeNull();
          expect(f.hit(f.player, f.actor)).toBeNull();
          expect(f.hit('env', f.actor, ['actor.player', 'dmg.melee'])).toBeNull();
          expect(f.hit('env', f.player, ['env.fire'])).toBeNull();
          expect([f.player.attributes.health, f.animal.hp]).toEqual(hp);
          expect(f.animal.hasImpulse).toBe(false);
        }
      }
      expect(f.reaction).not.toHaveBeenCalled(); expect(f.modified).not.toHaveBeenCalled(); expect(f.dealt).not.toHaveBeenCalled();
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) for (const distance of [249.99, 250]) {
        f.feet.set(x * distance, 0, z * distance);
        expect(f.hit(f.actor, f.player)?.dealt).toBe(1);
        expect(f.hit('env', f.actor, ['actor.player', 'dmg.melee'])?.dealt).toBe(1);
      }
      expect(f.player.attributes.health).toBe(92);
      expect(f.reaction).toHaveBeenCalledTimes(8); expect(f.modified).toHaveBeenCalledTimes(16); expect(f.dealt).toHaveBeenCalledTimes(16);
      expect(f.animal.hasImpulse).toBe(true);
    } finally { f.scope.dispose(); }
  }
});

it('checks delayed weapon delivery at the current feet and rejects other regional actor objects with identical ids', () => {
  const f = open(true), foreign = creature().combatActor();
  try {
    const projectile: DamageRequest = { source: 'env', sourceTags: ['actor.player', 'weapon.bow'], target: f.actor,
      amount: 7, point: new Vector3(), dir: new Vector3(1, 0, 0), knockback: 10 };
    f.feet.set(251, 0, 0); expect(f.combat.hit(projectile)).toBeNull();
    f.feet.set(249, 0, 0); expect(f.combat.hit(projectile)?.dealt).toBe(7);
    expect(f.hit(foreign, f.player)).toBeNull(); expect(f.hit(f.player, foreign)).toBeNull();
    f.animal.position.x = 250.01;
    expect(f.hit(f.actor, f.player)).toBeNull(); expect(f.hit(f.player, f.actor)).toBeNull();
  } finally { f.scope.dispose(); }
});

it('preserves independent page-local combat and removes the permission when its scope leaves', () => {
  const f = open(), other = creature().combatActor();
  try {
    f.feet.set(270, 0, 0);
    expect(f.hit(other, f.actor)?.dealt).toBe(1);
    expect(f.hit(f.player, f.actor)).toBeNull();
    f.scope.dispose(); expect(f.events.census()).toEqual({ listeners: 0, answerers: 0 });
    expect(f.hit(f.player, f.actor)?.dealt).toBe(1);
  } finally { f.scope.dispose(); }
});

it('keeps the terminal G129 fall independent of ordinary safe-zone damage', () => {
  const f = open(true);
  try {
    f.feet.set(270, -61, 0);
    expect(f.hit('env', f.player, ['env.fire'])).toBeNull();
    expect(f.combat.fall(f.player, f.feet, { kind: 'out-of-world', label: '' })?.killed).toBe(true);
    expect(f.player.alive).toBe(false);
  } finally { f.scope.dispose(); }
});
