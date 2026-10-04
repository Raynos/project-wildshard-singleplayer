/**
 * Nalati's map look (E357 S3.2, 07 §6.2 step 7; plan row B15 — it was Minimap.ts's `style === 'painterly'` branch): the
 * manifest's `minimap.palette`. The ground is painted in the shard's own colours — the green valley, the gold-olive Sky
 * Grassland, grey rock on the escarpment, snow over the snow line, the Kunes' braided channels (glacial blue) and gravel
 * bars, the plateau brook, the spruce floor from the chunk's own forest mask — then the spruce stipple and the roads. The
 * map-01 places (NALATI_MAP.pois) are the full map's pins (named once explored, "?" before); no pines or cabins.
 */
import { SEED } from '@wildshard/engine/core/config';
import { smoothstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import type { MinimapPalette, MapPoi, MapOverlay } from '@wildshard/engine/ui/Minimap';
import { NALATI_MAP, SNOW_LINE } from '../layout';
import { riverMask } from '../world/terrain';
import { nalatiWetAt } from '../wet';

type RGB = [number, number, number];
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

/** the spruce stipple's crowns (x, z, radius in m, colour 0 / 1), placed once per forest mask: every map tile used to walk
 *  the whole chunk (~14k mask calls per tile, E106); now a tile only draws the crowns on it. Same rng order, same dots. */
const stipples = new WeakMap<(x: number, z: number) => number, Float32Array>();
function stipple(half: number, forestMask: (x: number, z: number) => number): Float32Array {
  const known = stipples.get(forestMask);
  if (known) return known;
  const rng = new Rng(SEED + 4242), out: number[] = [];
  for (let x = -half + 3; x < half - 3; x += 4.2) for (let z = -half + 3; z < half - 3; z += 4.2) {
    const cx = x + rng.range(-1.6, 1.6), cz = z + rng.range(-1.6, 1.6);
    if (rng.next() > forestMask(cx, cz) * 0.85) continue;
    const r = 1.6 + rng.range(0, 1.1);
    out.push(cx, cz, r, rng.next() < 0.5 ? 0 : 1);
  }
  const list = Float32Array.from(out);
  stipples.set(forestMask, list);
  return list;
}

/** the spruce: a stipple of dark crowns where the forest mask keeps trees; the roads (the N road, the sky road's
 *  hairpins …): the chunk's trails, a warm dirt line */
function overlay({ ctx, toU, toV, ppm, trails, half, forestMask }: MapOverlay): void {
  if (forestMask) {
    const crowns = stipple(half, forestMask), w = ctx.canvas.width, h = ctx.canvas.height;
    for (let i = 0; i + 3 < crowns.length; i += 4) {
      const u = toU(crowns[i] ?? 0), v = toV(crowns[i + 1] ?? 0), r = (crowns[i + 2] ?? 0) * ppm;
      if (u + r + ppm < 0 || v + r + ppm < 0 || u - r > w || v - r > h) continue; // not on this tile (the shadow sits +0.8 m)
      ctx.fillStyle = 'rgba(14, 26, 18, 0.45)'; ctx.beginPath(); ctx.arc(u + 0.8 * ppm, v + 0.8 * ppm, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = crowns[i + 3] === 0 ? '#2c4a30' : '#38583a'; ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, style] of [[6, 'rgba(70, 54, 36, 0.8)'], [3.5, '#b89c70']] as const) {
    ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
    for (const poly of trails) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
    ctx.stroke();
  }
}

const pois = (): MapPoi[] => NALATI_MAP.pois.map((p) => ({ x: p.x, z: p.z, label: p.label, color: POI_COLOR }));

export const NALATI_MINIMAP: MinimapPalette = { ground, overlay, pois };
