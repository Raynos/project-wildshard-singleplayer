import { SWORD_WOOD } from '@wildshard/kit/weapons/melee/profiles';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import type { ShardSword } from '@wildshard/game/shard/manifest';

export interface JianRow extends MeleeProfile { viewmodel: () => Promise<ShardSword>; assets: readonly string[] }
export const JIAN_ROW: JianRow = {
  ...SWORD_WOOD, id: 'weapon.jian', parent: SWORD_WOOD.id, damage: 12,
  ui: { ...SWORD_WOOD.ui, name: 'Neon Jian' }, meta: { ...SWORD_WOOD.meta, name: 'Neon Jian' },
  feel: { ...SWORD_WOOD.feel, portraitFov: 78 },
  assets: ['/assets/nine-dragon/viewmodel/fp-rig.glb', ...['hand-r', 'arm-r', 'fist-l', 'gauntlet'].flatMap((name) =>
    [`/assets/nine-dragon/viewmodel/${name}-maps.webp`, `/assets/nine-dragon/viewmodel/${name}-nrm.webp`])],
  viewmodel: () => jianViewmodel(),
};

/** the skinned arms rig, or the static jian when the rig does not load; the loaders are the row's own by default */
const OWN_LOADERS = {
  arms: async (): Promise<ShardSword> => (await import('./arms')).jianArms(),
  sword: async (): Promise<ShardSword> => (await import('../world/jian')).jianSword(),
};
export async function jianViewmodel(load: { arms: () => Promise<ShardSword>; sword: () => Promise<ShardSword> } = OWN_LOADERS): Promise<ShardSword> {
  try { return await load.arms(); }
  catch (error) {
    console.warn('nine-dragon-stack: the arms rig did not load, the static jian stands in', error);
    return load.sword();
  }
}
