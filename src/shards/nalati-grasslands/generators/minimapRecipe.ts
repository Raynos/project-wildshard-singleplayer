/**
 * Nalati's map look (E357 S3.2, 07 §6.2 step 7; plan row B15 — it was Minimap.ts's `style === 'painterly'` branch): the
 * manifest's `minimap.palette`. The ground is painted in the shard's own colours — the green valley, the gold-olive Sky
 * Grassland, grey rock on the escarpment, snow over the snow line, the Kunes' braided channels (glacial blue) and gravel
 * bars, the plateau brook, the spruce floor from the chunk's own forest mask. The shared map renderer owns spruce
 * stipple and roads. The
 * map-01 places (NALATI_MAP.pois) are the full map's pins (named once explored, "?" before); no pines or cabins.
 */
import { smoothstep } from '@wildshard/sdk/noise';
import * as layoutRows from './layout';
import { riverMask } from './terrainRecipe';
import { nalatiWetAt } from './wetRecipe';

const { NALATI_MAP, SNOW_LINE } = layoutRows;

type RGB = [number, number, number];
interface MapPoi { x: number; z: number; label: string; color: string }
const mix = (a: RGB, b: RGB, t: number, out: RGB): RGB => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const POI_COLOR = '#f0e6c8';

/** the painted ground at one sample, by HEIGHT (so it follows any layout): the lowland green, the gold-green high meadow,
 *  grey rock where it is steep, snow over SNOW_LINE, the Kunes' glacial channels + gravel bars (riverMask), meltwater /
 *  the brook (nalatiWetAt), a darker floor where the spruce mask keeps trees */
function ground(x: number, z: number, h: number, slope: number, spruce: number, out: RGB): void {
  const VALLEY: RGB = [92, 128, 58], MEADOW: RGB = [176, 164, 86], MEADOW_HI: RGB = [192, 178, 104];
  const ROCK_N: RGB = [132, 130, 126], SNOW: RGB = [234, 238, 244], SPRUCE_FLOOR: RGB = [52, 70, 44];
  const CHANNEL: RGB = [112, 164, 194], GRAVEL: RGB = [180, 172, 154], MELT: RGB = [100, 156, 190];
  const high = smoothstep(2, 18, h);                                       // off the valley floor onto the high meadow
  mix(VALLEY, MEADOW, high, out);
  mix(out, MEADOW_HI, smoothstep(28, 40, h) * 0.5, out);
  mix(out, SPRUCE_FLOOR, Math.min(1, spruce) * 0.55, out);
  mix(out, ROCK_N, smoothstep(0.16, 0.42, slope), out);
  mix(out, SNOW, smoothstep(SNOW_LINE - 4, SNOW_LINE + 6, h), out);
  const rm = riverMask(x, z);
  if (rm > 0.35) { mix(GRAVEL, CHANNEL, smoothstep(0.55, 0.8, rm), out); return; }
  if (high > 0.5 && nalatiWetAt(x, z)) mix(out, MELT, 0.9, out);
}

const pois = (): MapPoi[] => NALATI_MAP.pois.map((p) => ({ x: p.x, z: p.z, label: p.label, color: POI_COLOR }));

/** The source map consumes only these owned numeric samples and place rows. */
export const NALATI_MINIMAP: { ground: typeof ground; pois?: typeof pois } = { ground, pois };
