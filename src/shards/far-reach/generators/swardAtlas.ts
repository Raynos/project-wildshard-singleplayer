import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';
import { SWARD_ATLAS } from '../data/swardAtlas';

/**
 * Build-time only (SHARD-PLATFORM M3): the sward's tuft atlas texels (data/swardAtlas.ts), baked by the generation job
 * `sky-sward-atlas` into a library texture the meadow graph samples (data/meadowLook.ts). The same strands, seeded,
 * drawn here once instead of on every load.
 */

/** One grass: how many strands, how long (share of the tuft's height), how wide at the root (texels), how they arch. */
interface Species { strands: number; len: readonly [number, number]; base: readonly [number, number]; spread: number; arch: number; stalks: number }
const SPECIES: readonly Species[] = [
  // the lawn: many fine short strands, bunched and upright (the mockups' low green carpet between the drifts)
  { strands: 80, len: [0.45, 0.95], base: [2.0, 3.4], spread: 0.36, arch: 0.2, stalks: 0 },
  // broad blades: fewer, wide, keeled, arching over and crossing (the mockups' foreground blades with a lit edge)
  { strands: 28, len: [0.5, 1.0], base: [5.0, 8.5], spread: 0.3, arch: 0.55, stalks: 0 },
  // the wild grass: thin long blades and a few seed-head stalks standing over the sward
  { strands: 45, len: [0.4, 0.85], base: [2.0, 3.4], spread: 0.32, arch: 0.3, stalks: 2 },
];

export function bakeSkySwardAtlas(seed = 6417): Uint8Array {
  const { variants, perSpecies, w, h } = SWARD_ATLAS, W = w * variants, data = new Uint8Array(W * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /** lay one texel of a strand: a later strand lies over an earlier one */
  const lay = (x0: number, px: number, row: number, cover: number, shade: number, along: number, across: number): void => {
    if (px < 0 || px >= w || row < 0 || row >= h || cover <= 0) return;
    const k = ((row * W) + x0 + px) * 4, prior = (data[k + 3] ?? 0) / 255;
    if (cover >= prior || cover > 0.5) {
      data[k] = Math.round(255 * shade); data[k + 1] = Math.round(255 * along); data[k + 2] = Math.round(255 * across);
      data[k + 3] = Math.round(255 * Math.max(prior, cover));
    }
  };
  for (let v = 0; v < variants; v++) {
    const x0 = v * w, sp = SPECIES[Math.min(SPECIES.length - 1, Math.floor(v / perSpecies))];
    if (sp === undefined) continue;
    // the seed stalks stand in one wild tuft of the two (round 1 of this row: in both, the wild patches read as white heather)
    const stalks = v % perSpecies === 1 ? sp.stalks : 0;
    for (let s = 0; s < sp.strands + stalks; s++) {
      const stalk = s >= sp.strands;
      // roots bunched in the middle, the outer strands shorter and leaning out (a tuft fans)
      const off = (rnd() + rnd() + rnd() - 1.5) / 1.5, rootX = w * (0.5 + off * sp.spread);
      const len = stalk ? h * (0.86 + 0.13 * rnd()) : h * (sp.len[0] + (sp.len[1] - sp.len[0]) * rnd()) * (1 - 0.3 * Math.abs(off));
      const lean = (off * 0.5 + (rnd() - 0.5) * 0.45) * len * (stalk ? 0.12 : 0.4);
      const curl = (rnd() - 0.5) * len * 0.1, base = stalk ? 1.1 : sp.base[0] + (sp.base[1] - sp.base[0]) * rnd(), shade = 0.3 + 0.7 * rnd();
      // some blades arch over and droop at the tip (the mockups' sward bends and crosses)
      const arch = !stalk && rnd() < sp.arch ? (rnd() < 0.5 ? -1 : 1) * len * (0.22 + 0.3 * rnd()) : 0;
      const steps = Math.ceil(len * 2);
      let tipX = rootX, tipY = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, y = t * len * (1 - 0.4 * Math.abs(arch) / len * t * t);
        let cx = rootX + lean * t * t + curl * Math.sin(t * Math.PI) + arch * t * t * t;
        // a broad blade keeps its width to two thirds, then narrows to a point; a fine one tapers all the way
        const hw = stalk ? 0.6 : sp.base[0] > 4 ? base * Math.min(1, 1.25 * (1 - t) ** 0.6) * 0.5 + 0.3 : base * (1 - t) ** 0.75 * 0.5 + 0.3;
        const row = Math.floor(y); if (row >= h) break;
        // kept inside its own cell, so no strand is cut at the variant's edge
        cx = Math.min(w - hw - 2, Math.max(hw + 1, cx));
        for (let px = Math.floor(cx - hw - 1); px <= Math.ceil(cx + hw + 1); px++) {
          const u = (px + 0.5 - cx) / Math.max(hw, 0.5);
          lay(x0, px, row, Math.min(1, Math.max(0, hw + 0.5 - Math.abs(px + 0.5 - cx))), shade * (1 - 0.2 * Math.min(1, Math.abs(u))), t, Math.min(1, Math.max(0, u * 0.5 + 0.5)));
        }
        tipX = cx; tipY = y;
      }
      if (!stalk) continue;
      // the seed head: a slim spike of grains along the stalk's top, a dull straw (G 0.82, a low shade: not a white flower)
      const head = h * (0.07 + 0.05 * rnd());
      for (let g = 0; g < 14; g++) {
        const gy = tipY - head * (g / 14), gx = tipX + (g % 2 ? 1 : -1) * (1.2 + 0.8 * rnd()), r = 1.5 + 0.8 * rnd();
        for (let py = Math.floor(gy - r * 1.6); py <= Math.ceil(gy + r * 1.6); py++) for (let px = Math.floor(gx - r); px <= Math.ceil(gx + r); px++) {
          const d = Math.hypot((px + 0.5 - gx) / r, (py + 0.5 - gy) / (r * 1.6));
          lay(x0, px, py, Math.min(1, Math.max(0, (1 - d) * 2)), 0.3 + 0.35 * rnd(), 0.82, Math.min(1, Math.max(0, (px + 0.5 - gx) / r * 0.5 + 0.5)));
        }
      }
    }
  }
  return data;
}

/** The atlas as a lossless, linear library texture (data/swardAtlas.ts `SWARD_ATLAS_FILE`): the same texels in the same row
 *  order, one level (the sampler's GPU mips build the chain, as the DataTexture's did). */
export async function bakeSwardAtlasTexture(): Promise<Uint8Array> {
  const { variants, w, h } = SWARD_ATLAS;
  const png = await writeImagePixels({ width: w * variants, height: h, pixels: new Uint8ClampedArray(bakeSkySwardAtlas()) });
  return bakeRawColourTexture(png, { colourSpace: 'linear' });
}
