import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';

import type { RGB } from '@wildshard/engine/entities/species/loft';

/** Authored horse tables; executable ports remain in the native species binding. */
declare const rows: {
  speeds: { walk: number; trot: number; canter: number; gallop: number };
  palette: Record<'coat' | 'belly' | 'points' | 'mane' | 'muzzle' | 'sock' | 'hoof' | 'eye' | 'earIn' | 'dorsal', RGB>;
  definition: Omit<SpeciesDef, 'build' | 'postPose' | 'act' | 'think' | 'damageMul' | 'fur'>;
  overlay: { smooth: [string, number, number, number][]; decay: [string, number][]; grazeRate: number };
};
// oxlint-disable-next-line import/no-default-export -- TypeScript requires a default declaration for this JSON module.
export default rows;
