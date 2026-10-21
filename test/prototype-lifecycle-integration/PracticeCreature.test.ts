// oxlint-disable-next-line import/no-nodejs-modules -- Use the installed physics WASM without network or product builds.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { Weapon } from '../../src/engine/combat/Weapon';
import { DEFAULT_CREATURE_RENDER } from '../../src/engine/entities/AnimalFactory';
import { CreatureBodies } from '../../src/engine/physics/creatures';
import { loadRapier } from '../../src/engine/physics/rapier';
import { createSimHost } from '../../src/engine/sim';
import { PracticeCreature } from '../../src/game/practice/PracticeCreature';
import { PracticeLoot } from '../../src/game/practice/PracticeLoot';
import { PracticePlayer } from '../../src/game/practice/PracticePlayer';
import { PracticePrototypeAnimal } from '../../src/game/practice/PracticePrototypeAnimal';
import { createShardProduct } from '../../src/game/shardfile/shardProduct';
import { SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';
import { BEAR_LOOK } from '../../src/game/systems/species/view/bear';
import { createPrototypeSource, prototypeCombat } from '../../practice/prototype-nine/products/author';
import { fakeWorld } from '../fake/world';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

class FixtureWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { /* Damage is submitted through the real routed combat pipeline. */ }
  update(): void { /* No weapon animation is claimed by this lifecycle fixture. */ }
}

/** Real lifecycle/physics with built-in geometry and an explicit player port, not browser or art acceptance. */
test('prototype bout retires collision and combat once, continues loot, and Retry rebuilds living ownership', async () => {
  const owner = new Scope('prototype-integration');
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, {
    scope: owner, rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),
  });
  const world = fakeWorld(), player = world.player, scene = new Scene();
  Object.assign(player, { carried: false, dodging: false, shove: () => undefined, impulse: () => undefined,
    spawn: (x: number, z: number, yaw: number, y: number) => { player.position.set(x, y, z); player.yaw = yaw; } });
  const start = player.position.clone(), startYaw = player.yaw;
  const weapons = new EquipmentService(new FixtureWeapon(SWORD_WOOD), { scope: owner });
  const source = createPrototypeSource('bellback');
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
    sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No product reads expected for a stalker')) });
  const combat = prototypeCombat('bellback');
  const species = { ...combat.species, id: 'kit.creature.bear', kind: 'bear', variants: [{ id: 'brown', label: 'Lifecycle fixture',
    rarity: 'common' as const, weight: 1, scale: [1, 1] as [number, number], hp: 20 }] };
  const damage = vi.fn<(...args: unknown[]) => void>(), death = vi.fn<() => void>(), collect = vi.fn<(coins: number) => void>();
  const drop = vi.spyOn(PracticeLoot.prototype, 'drop');
  const sync = vi.spyOn(CreatureBodies.prototype, 'sync');
  const remove = vi.spyOn(CreatureBodies.prototype, 'remove');
  const write = vi.spyOn(localStorage, 'setItem');
  let creature: PracticeCreature | undefined;
  const previousLevel = app.levelScope;
  try {
    app.levelScope = owner;
    app.species.registerRow(species, owner); app.species.registerLook(BEAR_LOOK, owner);
    creature = await PracticeCreature.create({ owner, species, strikes: combat.strikes, variant: 'brown',
      prototype: { death: 'despawn' }, scene, sky: world.sky, physics: outside.physics, player, product, weapons,
      style: 'toon', render: { ...DEFAULT_CREATURE_RENDER, lowPoly: true, waitForModels: false, furRim: false, oneMaterial: true },
      flash: () => undefined, onDamage: damage, onDeath: death, onCollect: collect });
    creature.enter({ x: 0, y: 0, z: 3 });
    const first = creature.targets[0];
    if (!(first instanceof PracticePrototypeAnimal)) throw new Error('Prototype owner was not selected');
    const initialHP = first.hp;
    expect(first.motor).not.toBeNull();
    expect(app.combat.target(first)).not.toBeNull();
    const hitOrigin = new Vector3(); first.headWorld(hitOrigin); hitOrigin.z -= 4;
    outside.physics.step();
    expect(creature.raycast(hitOrigin, new Vector3(0, 0, 1), 8)?.animal).toBe(first);
    const hit = (amount: number) => app.combat.hit({ source: 'env', sourceTags: ['dmg.melee'],
      target: first.combatActor(), amount, point: first.position.clone(), dir: new Vector3(0, 0, 1) });
    expect(hit(1)?.killed).toBe(false);
    expect(first.hp).toBeLessThan(initialHP);
    expect(hit(10000)?.killed).toBe(true);
    expect(first.hp).toBe(0); expect(first.alive).toBe(false);
    expect(first.hidden).toBe(true); expect(first.mesh.visible).toBe(false);
    expect(first.motor).toBeNull(); expect(remove).toHaveBeenCalledWith(first);
    expect(app.combat.target(first)).toBeNull();
    expect(creature.raycast(hitOrigin, new Vector3(0, 0, 1), 8)).toBeNull();
    expect(drop).toHaveBeenCalledOnce(); expect(death).toHaveBeenCalledOnce();
    expect(damage).toHaveBeenCalledTimes(2);
    expect(hit(10000)).toBeNull();
    const syncCount = sync.mock.calls.length;
    const loot: unknown = Reflect.get(creature, 'loot');
    if (!(loot instanceof PracticeLoot)) throw new Error('Missing real local loot');
    for (let frame = 0; frame < 300; frame++) creature.update(1 / 60);
    expect(sync).toHaveBeenCalledTimes(syncCount);
    expect(drop).toHaveBeenCalledOnce(); expect(death).toHaveBeenCalledOnce();
    expect(loot.receipt.complete).toBe(true); expect(collect).toHaveBeenCalled();
    const localPlayer: unknown = Reflect.get(creature, 'practicePlayer');
    if (!(localPlayer instanceof PracticePlayer)) throw new Error('Missing real practice player');
    localPlayer.hurt(first, 10000); creature.update(1 / 60);
    expect(creature.playerHealth).toBe(0); expect(player.carried).toBe(true); expect(weapons.enabled).toBe(false);
    player.position.set(9, 0, 9); player.yaw = 2;
    creature.retry();
    const fresh = creature.targets[0];
    if (!(fresh instanceof PracticePrototypeAnimal)) throw new Error('Retry lost prototype owner');
    expect(fresh).not.toBe(first); expect(fresh.hp).toBe(initialHP);
    expect(fresh.alive).toBe(true); expect(fresh.hidden).toBe(false); expect(fresh.mesh.visible).toBe(true);
    expect(first.mesh.parent).toBeNull(); expect(first.motor).toBeNull(); expect(fresh.motor).not.toBeNull();
    expect(app.combat.target(first)).toBeNull(); expect(app.combat.target(fresh)).not.toBeNull();
    expect(creature.targets).toHaveLength(1); expect(creature.playerHealth).toBe(creature.playerMaxHealth);
    expect(player.carried).toBe(false); expect(weapons.enabled).toBe(true);
    expect(player.position).toEqual(start); expect(player.yaw).toBe(startYaw);
    const freshLoot: unknown = Reflect.get(creature, 'loot');
    if (!(freshLoot instanceof PracticeLoot)) throw new Error('Retry lost local loot');
    expect(freshLoot).not.toBe(loot); expect(freshLoot.receipt).toEqual({ scope: 'practice', coins: 0, complete: false });
    creature.exit(); creature.exit();
    expect(creature.targets).toHaveLength(0); expect(app.combat.target(fresh)).toBeNull();
    expect(fresh.mesh.parent).toBeNull(); expect(fresh.motor).toBeNull();
    expect(write).not.toHaveBeenCalled();
  } finally { creature?.dispose(); owner.dispose(); world.game.playerScope.dispose(); app.levelScope = previousLevel; }
});
