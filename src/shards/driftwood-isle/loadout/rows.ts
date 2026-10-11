import { applyMeleeCombatProfile } from '@wildshard/engine/combat/meleeProfile';
import source from '../shard.config';
import type { World } from '@wildshard/engine/core/bootstrap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { SWORD_WOOD, SWORD_IRON } from '@wildshard/game/weapons/starterMeleeProfile';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { driftwoodWorld } from '../world/build';
import { IronSwordPickup, ironSwordSite } from '../weapons/IronSword';

const drops = new WeakMap<ShardRuntime, IronSwordPickup>();

/** The adventure still owns the sailor guard; the service owns taking and saving the sword. */
export function ironSwordDrop(shell: ShardRuntime): IronSwordPickup | null { return drops.get(shell) ?? null; }

/** Compose admitted combat numbers while retaining the guarded iron pickup owner. */
export function driftwoodLoadoutRows(world: World, shell: ShardRuntime): readonly [MeleeProfile, MeleeProfile] {
  const declaredWood = source.items.rows[0], declaredIron = source.items.rows[1];
  if (declaredWood?.kind !== 'weapon' || declaredIron?.kind !== 'weapon' || declaredWood.profile?.family !== 'melee' || declaredIron.profile?.family !== 'melee') throw new Error('Driftwood declares both swords');
  const wood = applyMeleeCombatProfile(SWORD_WOOD, declaredWood.profile);
  const iron: MeleeProfile = { ...applyMeleeCombatProfile(SWORD_IRON, declaredIron.profile), pickup: {
    owned: 'iron-sword', prompt: 'Take iron sword', toast: 'Iron sword acquired · 1/2 to switch, Q to swap',
    create: (at, prompt) => {
      if (at !== 'wreck.deck') throw new Error(`Unknown iron sword pickup site: ${at}`);
      const wreck = driftwoodWorld(shell).wreck;
      if (wreck === null) return null;
      const { game, sky, player } = world;
      const drop = new IronSwordPickup({ scene: game.scene, sky, position: ironSwordSite(wreck, heightAt), prompt });
      const update = drop.update.bind(drop);
      drop.update = (dt, t) => { update(dt, t, game.renderer, game.camera, player.position); };
      drops.set(shell, drop);
      return drop;
    },
  } };
  return [wood, iron];
}

export function clearDriftwoodDrop(shell: ShardRuntime): void { drops.delete(shell); }
