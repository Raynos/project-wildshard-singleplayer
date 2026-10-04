/**
 * Driftwood's far proxy look (SHARD-PLATFORM SF23), read only by the far baker (scripts/bake/far-proxies.mjs): the
 * faceted low-poly toon terrain in its own ground palette (`lowPolyGroundColor`, the same function the terrain painter
 * reads), the lagoon as a turquoise sheet at the sea line, and a bright tropical haze.
 */
import { Color } from 'three';
import { lowPolyGroundColor } from './groundColor';

const out = new Color();
export const farLook = {
  family: 'toon',
  colourAt: (x: number, z: number, h: number, slope: number): [number, number, number] => { lowPolyGroundColor(out, h, slope, x, z); return [out.r, out.g, out.b]; },
  water: { level: 0, colour: [0.05, 0.42, 0.5] },
  haze: { colour: [0.6, 0.78, 0.92], near: 450, far: 2600, max: 0.55 },
} as const;
