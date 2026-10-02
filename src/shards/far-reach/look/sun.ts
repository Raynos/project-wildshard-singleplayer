import { Vector3 } from 'three';

/**
 * Golden hour, fixed: the sun sits low ahead of the spawn, just left of the windmill isle (the mockup's frame), so the
 * route looks into it: every island is back-lit, and look/light.ts paints the bounce and the rim that keep it readable.
 */
export const SUN_DIR = new Vector3(-0.16, 0.15, -0.97).normalize();
/** The painted sky (sRGB): a soft blue-lavender zenith, a peach-pink middle, a gold horizon; mauve cloud bellies, gold-pink tops; the
 * near cloud sea in the panorama's own palette (loop 4: lavender hollows, peach-gold tops; look/sky.ts). */
export const SKY = {
  zenith: 0x7f95d0, mid: 0xefb9ad, horizon: 0xffd89c, below: 0xf6e3d6, sun: 0xffdba2, key: 0xffd2a2, fog: 0xf0c9b6,
  cloudShade: 0xb08fb4, cloudShadeWarm: 0xe0a294, cloudLit: 0xffe0c4, isle: 0x9d8fb8, isleLit: 0xe2ad8c,
  seaShade: 0x9c7394, seaShadeWarm: 0xc98a86, seaLit: 0xffd3b2,
} as const;
export const FOG = { near: 110, far: 460 } as const;
