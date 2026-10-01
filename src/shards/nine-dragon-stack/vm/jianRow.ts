import { SWORD_WOOD, type MeleeProfile } from '#kit';
import type { ShardSword } from '#game';

export interface JianRow extends MeleeProfile { viewmodel: () => Promise<ShardSword>; assets: readonly string[] }
export const JIAN_ROW: JianRow = {
  ...SWORD_WOOD, id: 'weapon.jian', parent: SWORD_WOOD.id, damage: 12,
  ui: { ...SWORD_WOOD.ui, name: 'Neon Jian' }, meta: { ...SWORD_WOOD.meta, name: 'Neon Jian' },
  feel: { ...SWORD_WOOD.feel, portraitFov: 78 },
  assets: ['/assets/nine-dragon/viewmodel/fp-rig.glb', ...['hand-r', 'arm-r', 'fist-l', 'gauntlet'].flatMap((name) =>
    [`/assets/nine-dragon/viewmodel/${name}-maps.webp`, `/assets/nine-dragon/viewmodel/${name}-nrm.webp`])],
  viewmodel: async () => {
    try { return await (await import('./arms')).jianArms(); }
    catch (error) {
      console.warn('nine-dragon-stack: the arms rig did not load, the static jian stands in', error);
      return (await import('../world/jian')).jianSword();
    }
  },
};
