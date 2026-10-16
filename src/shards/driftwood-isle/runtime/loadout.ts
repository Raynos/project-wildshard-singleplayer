import { createClientScene } from '@wildshard/game/plugin/ui';
import type { Group, Material } from 'three';
import { IRON_SWORD_BLADE_GEOMETRY, IRON_SWORD_FITTINGS_GEOMETRY } from './boot/fixedGeometry';
import { FP_ARMS_MATERIALS } from './const';
import type { MeleeCombatProfile } from '@wildshard/engine/combat/meleeProfile';
import { driftwoodRows } from './boot/rows';
import { bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { Sword } from '@wildshard/game/weapons/Sword';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';

/** The exact declared profiles already used to construct the native sword rows. */
export function driftwoodSwordProfiles(ctx: Pick<ShardContext, 'product'>): readonly [MeleeCombatProfile, MeleeCombatProfile] {
  const rows = ctx.product.section('combat/items').items.rows;
  const wood = rows.find(row => row.id === 'weapon.driftwood-isle.wood'), iron = rows.find(row => row.id === 'weapon.driftwood-isle.iron');
  if (wood?.kind !== 'weapon' || wood.profile?.family !== 'melee' || iron?.kind !== 'weapon' || iron.profile?.family !== 'melee') throw new Error('Driftwood requires both admitted sword profiles');
  return [wood.profile, iron.profile];
}

/** Both swords use the same castaway rig parts the shell already loaded, with the original task break. */
export function installDriftwoodLoadout(world: World, shell: ShardRuntime, rows: readonly [MeleeProfile, MeleeProfile], ctx: Parameters<typeof bindRuntimeItems>[0] & Pick<ShardContext, 'product'>): void {
  const [woodProfile, ironProfile] = driftwoodSwordProfiles(ctx);
  shell.buildEquipment = async (targets, nolock, viewmodel?: ShardSword | null) => {
    if (viewmodel?.arms === undefined || viewmodel.ironArms === undefined) throw new Error('Driftwood requires both native sword arms');
    const { ironArms, swim: _swim, ...woodArms } = viewmodel;
    const [wood, iron] = rows;
    const primary = new Sword(world, targets, { row: wood, profile: wood, allowUnlocked: nolock, ...woodArms,
      ...(world.game.level.camera ? { portraitFov: world.game.level.camera.portraitFov } : {}) });
    await macrotask();
    const melee: ItemFamily = { kind: 'weapon', profiles: ['melee'], create: (row, spec, ports) => {
      if (spec.id === 'weapon.driftwood-isle.wood' && JSON.stringify(ports.profile) === JSON.stringify(woodProfile)) return primary;
      if (spec.id === 'weapon.driftwood-isle.iron' && JSON.stringify(ports.profile) === JSON.stringify(ironProfile)) {
        return new Sword(world, targets, { row: iron, profile: iron, allowUnlocked: nolock, blade: 'iron', arms: ironArms });
      }
      throw new Error(`Native Driftwood sword was built from a different authored profile: ${row.id}`);
    } };
    const bound = bindRuntimeItems(ctx, ctx.product.shardfile, { families: new Map(), kit: new Map([['melee', melee]]), icon: () => 'sword' });
    if (bound.primary !== primary) throw new Error('Driftwood declares the wooden sword first');
    // The normal loadout owns the original pickup/Owned lock; do not unlock the iron sword via declared defaults.
    return { primary, rifle: null, secondary: null, extras: [...bound.extras] };
  };
}

/** Authored world pickup scene: original owned copies and borrowed world graph materials. */
export function buildIronSwordDisplay(materials: ReadonlyMap<string, Material>): Group {
  const blade = materials.get(FP_ARMS_MATERIALS.pickupBlade), fittings = materials.get(FP_ARMS_MATERIALS.pickupFittings);
  if (blade === undefined || fittings === undefined) throw new Error('Iron sword display requires its graph materials');
  const made=createClientScene(driftwoodRows('custom/fixedLayouts').ironSword,{
    geometry:id=>{if(id==='blade')return IRON_SWORD_BLADE_GEOMETRY.copy();if(id==='fittings')return IRON_SWORD_FITTINGS_GEOMETRY.copy();throw new Error('Unknown declared iron sword geometry');},
    materials: new Map([['blade', blade], ['fittings', fittings]]),
  });
  const root=made.group('pickup');if(root===null)throw new Error('Iron sword display requires its declared group');return root;
}

/** The required native model load propagates failures to equipment boot. */
export async function loadSword(): Promise<ShardSword> {
  return (await import('./fpArms')).castawayArms();
}
