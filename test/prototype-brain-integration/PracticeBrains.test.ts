// oxlint-disable-next-line import/no-nodejs-modules -- Use installed Rapier bytes; no browser or build is started.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { Weapon } from '../../src/engine/combat/Weapon';
import { DEFAULT_CREATURE_RENDER } from '../../src/engine/entities/AnimalFactory';
import { loadRapier } from '../../src/engine/physics/rapier';
import { createSimHost } from '../../src/engine/sim';
import { PracticeCreature } from '../../src/game/practice/PracticeCreature';
import { PracticePrototypeAnimal } from '../../src/game/practice/PracticePrototypeAnimal';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { BEAR_LOOK } from '../../src/game/systems/species/view/bear';
import { SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';
import { createPrototypeSource, prototypeCombat } from '../../practice/prototype-nine/products/author';
import { PROTOTYPE_PRODUCTS } from '../../practice/prototype-nine/products/catalogue';
import { fakeWorld } from '../fake/world';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

class FixtureWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { /* This fixture observes creature attacks, not sword input. */ }
  update(): void { /* No weapon animation is claimed. */ }
}

// Actual authored species/strikes, brain admission, PracticeCreature clock and health pipeline.
// The substitute bear geometry deliberately makes no retained-model/visual acceptance claim.
for (const row of PROTOTYPE_PRODUCTS) {
  test(`${row.id} approaches, respects windup/once/cooldown, rearms, and stops damage when killed mid-tell`, async () => {
    const owner = new Scope(`prototype-brain-${row.id}`), previousLevel = app.levelScope;
    const world = fakeWorld(), player = world.player;
    Object.assign(player, { carried: false, dodging: false, shove: () => undefined, impulse: () => undefined });
    const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, {
      scope: owner, rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),
    });
    const weapons = new EquipmentService(new FixtureWeapon(SWORD_WOOD), { scope: owner });
    const { species, strikes } = prototypeCombat(row.id), source = createPrototypeSource(row.id);
    const strike = strikes[0];
    if (strike === undefined || species.brain?.archetype !== 'stalker') throw new Error('Missing prototype combat contract');
    const { attackDuration, attackCooldown } = species.brain.data;
    const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
      sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('Stalker should not read a decision product')) });
    const hits: { time: number; amount: number }[] = [], starts: number[] = [];
    let time = 0, creature: PracticeCreature | undefined;
    try {
      app.levelScope = owner;
      app.species.registerRow(species, owner);
      app.species.registerLook({ ...BEAR_LOOK, id: `test.look.${row.id}`, species: species.id, kind: species.kind }, owner);
      creature = await PracticeCreature.create({ owner, species, strikes, variant: row.variant,
        prototype: { death: 'despawn' }, scene: new Scene(), sky: world.sky, physics: host.physics, player, product, weapons,
        style: 'toon', render: { ...DEFAULT_CREATURE_RENDER, lowPoly: true, waitForModels: false, furRim: false, oneMaterial: true },
        flash: () => undefined, onPlayerDamage: amount => { hits.push({ time, amount }); } });
      creature.enter({ x: 0, y: 0, z: 10 });
      const animal = creature.targets[0];
      if (!(animal instanceof PracticePrototypeAnimal)) throw new Error('Missing real prototype actor');
      const originalStart = animal.startAttack.bind(animal);
      vi.spyOn(animal, 'startAttack').mockImplementation(duration => { starts.push(time); originalStart(duration); });
      const active = creature, dt = 1 / 60;
      const tick = () => { time += dt; active.update(dt); host.physics.step(); };
      const until = (ready: () => boolean) => {
        for (let frame = 0; frame < 600 && !ready(); frame++) tick();
        expect(ready()).toBe(true);
      };
      const before = animal.position.clone();
      for (let frame = 0; frame < 90; frame++) tick();
      expect(animal.position.distanceTo(before)).toBeGreaterThan(.1);
      expect(animal.position.distanceTo(player.position)).toBeLessThan(before.distanceTo(player.position));
      expect(hits).toHaveLength(0);
      // Deliberate contact placement isolates attack timing, not end-to-end player control.
      player.position.copy(animal.position).add(new Vector3(0, 0, -row.reach * .65));
      until(() => starts.length === 1);
      const firstStart = starts[0]; if (firstStart === undefined) throw new Error('Missing first tell');
      while (time < firstStart + strike.windup - 2 * dt) { tick(); expect(hits).toHaveLength(0); }
      until(() => hits.length === 1);
      const first = hits[0]; if (first === undefined) throw new Error('Missing first damage');
      expect(first.amount).toBe(row.damage);
      expect(first.time - firstStart).toBeGreaterThanOrEqual(strike.windup - dt);
      expect(first.time - firstStart).toBeLessThanOrEqual(strike.windup + 2 * dt);
      // Every intervening body/decision frame must preserve the one-hit attack latch.
      until(() => starts.length === 2);
      expect(hits).toHaveLength(1);
      const secondStart = starts[1]; if (secondStart === undefined) throw new Error('Missing rearmed tell');
      expect(secondStart - firstStart).toBeGreaterThanOrEqual(attackDuration + attackCooldown - .11);
      expect(secondStart - firstStart).toBeLessThanOrEqual(attackDuration + attackCooldown + .3);
      until(() => hits.length === 2);
      const second = hits[1]; if (second === undefined) throw new Error('Missing second damage');
      expect(second.amount).toBe(row.damage);
      expect(second.time - secondStart).toBeGreaterThanOrEqual(strike.windup - dt);
      expect(second.time - secondStart).toBeLessThanOrEqual(strike.windup + 2 * dt);
      expect(creature.playerHealth).toBe(creature.playerMaxHealth - row.damage * 2);
      until(() => starts.length === 3);
      expect(hits).toHaveLength(2);
      expect(app.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: animal.combatActor(),
        amount: 10000, point: animal.position.clone(), dir: new Vector3(0, 0, 1) })?.killed).toBe(true);
      expect(animal.alive).toBe(false);
      // The real health owner regenerates after six seconds; death must never cause another decrease.
      for (let frame = 0; frame < 300; frame++) {
        const previousHealth = creature.playerHealth; tick();
        expect(creature.playerHealth).toBeGreaterThanOrEqual(previousHealth);
      }
      expect(hits).toHaveLength(2); expect(starts).toHaveLength(3);
      expect(creature.playerHealth).toBeLessThanOrEqual(creature.playerMaxHealth);
    } finally { creature?.dispose(); owner.dispose(); world.game.playerScope.dispose(); app.levelScope = previousLevel; }
  });
}
