import { FAN_LEAF_URL, TEX_URL } from './files';

/** Original ordered paint groups, sampler settings, required world material ports and the look bumps they feed. */
export const SKY_WORLD_PREPARATION = {
  textures: [
    { id: 'leaf', url: FAN_LEAF_URL, name: 'far.fan-leaf', warn: '[far-reach] far.fan-leaf not loaded:', phase: 0, sampler: { release: true } },
    { id: 'millStone', url: TEX_URL.millStone, name: 'far.mill-stone', warn: '[far-reach] far.mill-stone not loaded:', phase: 1,
      sampler: { release: true, wrapS: 1000, wrapT: 1000, mips: true, minFilter: 1008, anisotropy: 4 } },

  ],
  requiredMaterials: ['deck-wood', 'hover-frame'],
  // the windmill's painted stone (art/far-reach/round-18-windmill) as the `mill-tower` look's bump on the tower's second UV
  // set, so the courses and the mortar read (data/millLook.ts multiplies the same courses into the paint)
  bumps: [{ material: 'mill-tower', texture: 'millStone', channel: 1, scale: 2 }],
} as const;
