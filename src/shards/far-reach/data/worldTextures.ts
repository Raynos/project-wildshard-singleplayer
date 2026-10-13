import { TEX_URL } from './files';

/** Original ordered world paint requests; sampler recipes also accompany the immutable library maps. */
export const SKY_WORLD_TEXTURES = [
  { url: TEX_URL.rock, name: 'far.rock', tile: true },
  { url: TEX_URL.meadow, name: 'far.meadow', tile: true },
  { url: TEX_URL.millStone, name: 'far.mill-stone', tile: true },
  { url: TEX_URL.millCanvas, name: 'far.mill-canvas', tile: false },
  { url: TEX_URL.millIvy, name: 'far.mill-ivy', tile: false },
  { url: TEX_URL.stormeye, name: 'far.stormeye', tile: false },
] as const;
