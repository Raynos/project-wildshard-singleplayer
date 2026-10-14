import { SWORD_GEOMETRY } from '../boot/swordGeometry';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../data/meleeProfile';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { Sword } from '@wildshard/game/weapons/Sword';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import source from '../shard.config';
import { swordRig } from '../weapons/swordView';

/** Both swords use the same castaway rig parts the shell already loaded, with the original task break. */
export function installDriftwoodLoadout(world: World, shell: ShardRuntime, rows: readonly [MeleeProfile, MeleeProfile], ctx: ShardContext): void {
  shell.buildEquipment = async (targets, nolock, viewmodel?: ShardSword | null) => {
    await SWORD_GEOMETRY.preload();
    const { ironArms, swim: _swim, ...woodArms } = viewmodel ?? {};
    const [wood, iron] = rows;
    const primary = new Sword(world, targets, { row: wood, profile: wood, allowUnlocked: nolock, rig: swordRig(world.sky, 'wood'), ...woodArms,
      ...(world.game.level.camera ? { portraitFov: world.game.level.camera.portraitFov } : {}) });
    await macrotask();
    const melee: ItemFamily = { kind: 'weapon', profiles: ['melee'], create: (row, spec, ports) => {
      if (spec.id === 'weapon.driftwood-isle.wood' && JSON.stringify(ports.profile) === JSON.stringify(DRIFTWOOD_MELEE_PROFILE)) return primary;
      if (spec.id === 'weapon.driftwood-isle.iron' && JSON.stringify(ports.profile) === JSON.stringify(DRIFTWOOD_IRON_PROFILE)) {
        return new Sword(world, targets, { row: iron, profile: iron, allowUnlocked: nolock, blade: 'iron', rig: swordRig(world.sky, 'iron'), ...(ironArms ? { arms: ironArms } : {}) });
      }
      throw new Error(`Native Driftwood sword was built from a different authored profile: ${row.id}`);
    } };
    const bound = bindRuntimeItems(ctx, source, { families: new Map(), kit: new Map([['melee', melee]]), icon: () => 'sword' });
    if (bound.primary !== primary) throw new Error('Driftwood declares the wooden sword first');
    // The normal loadout owns the original pickup/Owned lock; do not unlock the iron sword via declared defaults.
    return { primary, rifle: null, secondary: null, extras: [...bound.extras] };
  };
}
