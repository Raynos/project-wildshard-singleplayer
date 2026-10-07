import { macrotask } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { SWORD_WOOD, SWORD_IRON } from '@wildshard/kit/weapons/melee/profiles';
import { Sword } from '@wildshard/kit/weapons/melee/SweptMelee';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { driftwoodWorld } from '../world/build';
import { IronSwordPickup, ironSwordSite } from '../weapons/IronSword';
import { swordRig } from '../weapons/swordView';

const drops = new WeakMap<ShardRuntime, IronSwordPickup>();

/** The adventure still owns the sailor guard; the service owns taking and saving the sword. */
export function ironSwordDrop(shell: ShardRuntime): IronSwordPickup | null { return drops.get(shell) ?? null; }

export function driftwoodLoadoutRows(world: World, shell: ShardRuntime): readonly [MeleeProfile, MeleeProfile] {
  const wood: MeleeProfile = { ...SWORD_WOOD };
  const iron: MeleeProfile = { ...SWORD_IRON, pickup: {
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

/** Both swords use the same castaway rig parts the shell already loaded, with the original task break. */
export function installDriftwoodLoadout(world: World, shell: ShardRuntime, rows: readonly [MeleeProfile, MeleeProfile]): void {
  shell.buildEquipment = async (targets, nolock, viewmodel?: ShardSword | null) => {
    const { ironArms, swim: _swim, ...woodArms } = viewmodel ?? {};
    const [wood, iron] = rows;
    const primary = new Sword(world, targets, { row: wood, profile: wood, allowUnlocked: nolock, rig: swordRig(world.sky, 'wood'), ...woodArms,
      ...(world.game.level.camera ? { portraitFov: world.game.level.camera.portraitFov } : {}) });
    await macrotask();
    const extra = new Sword(world, targets, { row: iron, profile: iron, allowUnlocked: nolock, blade: 'iron', rig: swordRig(world.sky, 'iron'), ...(ironArms ? { arms: ironArms } : {}) });
    return { primary, rifle: null, secondary: null, extras: [extra] };
  };
}

export function clearDriftwoodDrop(shell: ShardRuntime): void { drops.delete(shell); }
