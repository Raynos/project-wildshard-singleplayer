import { Vector3 } from 'three';
import { PANO_SUN } from './panoramaData';

/**
 * Golden hour, fixed: the sun sits low ahead of the spawn, just left of the windmill isle (the mockup's frame), so the
 * route looks into it: every island is back-lit, and look/light.ts paints the bounce and the rim that keep it readable.
 * Loop 5 (council R1B-1): the key light comes from where the panorama paints the sun (look/panoramaData.ts).
 */
export const SUN_DIR = sunFromHeading(PANO_SUN.heading, PANO_SUN.elevation);
/** A direction from a panorama heading (degrees: 0 = −z, 90 = +x) and elevation (degrees). */
export function sunFromHeading(heading: number, elevation: number): Vector3 {
  const h = (heading * Math.PI) / 180, e = (elevation * Math.PI) / 180;
  return new Vector3(Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)).normalize();
}
/** The painted sky (sRGB): a soft blue-lavender zenith, a peach-pink middle, a gold horizon; mauve cloud bellies, gold-pink tops; the
 * near cloud sea in the panorama's own palette (loop 4: lavender hollows, peach-gold tops; look/sky.ts). */
export const SKY = {
  zenith: 0x7f95d0, mid: 0xefb9ad, horizon: 0xffd89c, below: 0xf6e3d6, sun: 0xffdba2, key: 0xffd2a2, fog: 0xf0c9b6,
  cloudShade: 0xb08fb4, cloudShadeWarm: 0xe0a294, cloudLit: 0xffe0c4, isle: 0x9d8fb8, isleLit: 0xe2ad8c,
  seaShade: 0xa29dbd, seaShadeWarm: 0xe6b996, seaLit: 0xfff3e2,
} as const;
/** E392 (the targets are clear and golden, our frames sat under a rose veil): the haze starts later and never covers more than `max`. */
/** E399 (the council: 'grey-beige haze on the middle-distance islands'): a thinner veil */
export const FOG = { near: 160, far: 720, max: 0.5 } as const;
