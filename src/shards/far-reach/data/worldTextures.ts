import { FAN_LEAF_URL, TEX_URL } from './files';

/** Original ordered paint groups, sampler settings and required world material ports. */
export const SKY_WORLD_PREPARATION = {
  textures: [
    { id: 'leaf', url: FAN_LEAF_URL, name: 'far.fan-leaf', warn: '[far-reach] far.fan-leaf not loaded:', phase: 0, sampler: { release: true } },
    { id: 'millStone', url: TEX_URL.millStone, name: 'far.mill-stone', warn: '[far-reach] far.mill-stone not loaded:', phase: 1,
      sampler: { release: true, wrapS: 1000, wrapT: 1000, mips: true, minFilter: 1008, anisotropy: 4 } },

  ],
  requiredMaterials: ['deck-wood', 'hover-frame'],
} as const;
