/**
 * Nalati's far proxy look (SHARD-PLATFORM SF23), read only by the far baker (scripts/bake/far-proxies.mjs): the
 * painterly steppe from 0.5–2.4 km. Its splat is [grass, gravel + dirt, rock, snow]: lush valley green turning
 * gold-green up the bowl, grey outcrops and the snow ring's white crowns, in soft painted patches; the river (level −10)
 * is the ground colour's blue.
 */
type Splat = readonly [number, number, number, number];
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const farLook = {
  family: 'painterly',
  colourAt: (x: number, z: number, h: number, _slope: number, w: Splat): [number, number, number] => {
    if (h < -9.6) return [0.12, 0.26, 0.32];
    const patch = 0.5 + 0.5 * Math.sin(x * 0.019 + Math.sin(z * 0.023) * 1.7) * Math.cos(z * 0.017 - x * 0.006), gold = smooth(12, 30, h) * (0.4 + 0.6 * patch);
    const grass: [number, number, number] = [0.16 + 0.2 * gold + 0.04 * patch, 0.33 + 0.08 * gold + 0.05 * patch, 0.07 + 0.02 * patch];
    return [grass[0] * w[0] + 0.4 * w[1] + 0.33 * w[2] + 0.88 * w[3], grass[1] * w[0] + 0.37 * w[1] + 0.33 * w[2] + 0.91 * w[3], grass[2] * w[0] + 0.3 * w[1] + 0.34 * w[2] + 0.97 * w[3]];
  },
  // G222: its exposed boundary is the native slab's granite (look/terrainPainter.ts rockMid → deep), not the snow ring's
  // white, scaled to how this painterly proxy draws in the grid's daylight: a sun-facing face renders ~4× its colour
  // (measured on the west road face: ×1 → sRGB 159, ×0.5 → 145, ×0.25 → 109, ×0.125 → 67), so rockMid ×0.3 lands
  // on the warm grey-brown of the seam's rock instead of clipping to white
  cliff: { lip: [0.09, 0.081, 0.075], foot: [0.04, 0.04, 0.048] },
  haze: { colour: [0.62, 0.78, 0.98], near: 500, far: 2800, max: 0.5 },
} as const;
