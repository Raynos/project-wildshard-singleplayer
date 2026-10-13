import { MeshStandardMaterial } from 'three';

/** The Sky Reach palette (sRGB hex): golden-hour grass, warm dirt, warm brown-grey keel strata, green pines (the mockup's). */
export const PALETTE = {
  grass: 0x7d9640, grassLight: 0xa6ad55, dirt: 0x8a6446, rock: 0x8a7468, rockDark: 0x6a5560,
  pine: 0x3f5a3c, trunk: 0x5a3f2e, plank: 0x8d6a4c, rope: 0x6a5c4a, tower: 0xd8cfc2, sail: 0xe8dcc4, glow: 0x9fe6f2,
} as const;

export const flat = (color = 0xffffff, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

