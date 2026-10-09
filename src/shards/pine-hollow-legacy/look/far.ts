/**
 * Pine Hollow's far proxy look (SHARD-PLATFORM SF23), read only by the far baker (scripts/bake/far-proxies.mjs): the
 * PBR forest seen from 0.5–2.4 km. Its splat is [forest floor, grass, rock, dirt trail]; the forest floor carries a
 * canopy lift, so the pines read as a dark mass standing on the ground with meadows, crags and trails between them.
 * The pond (level −3) is dark water in the ground colour.
 */
type Splat = readonly [number, number, number, number];
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const canopy = (w: Splat, slope: number): number => smooth(0.35, 0.75, w[0]) * (1 - smooth(0.25, 0.45, slope));
export const farLook = {
  family: 'pbr',
  colourAt: (x: number, z: number, h: number, slope: number, w: Splat): [number, number, number] => {
    if (h < -3.2) return [0.03, 0.06, 0.07];
    const c = canopy(w, slope), mottle = 0.9 + 0.1 * Math.sin(x * 0.07 + Math.cos(z * 0.05) * 2);
    const ground: [number, number, number] = [0.06 * w[0] + 0.16 * w[1] + 0.26 * w[2] + 0.3 * w[3], 0.07 * w[0] + 0.24 * w[1] + 0.25 * w[2] + 0.22 * w[3], 0.04 * w[0] + 0.07 * w[1] + 0.23 * w[2] + 0.14 * w[3]];
    const pine: [number, number, number] = [0.025 * mottle, 0.06 * mottle, 0.035 * mottle];
    return [ground[0] + (pine[0] - ground[0]) * c, ground[1] + (pine[1] - ground[1]) * c, ground[2] + (pine[2] - ground[2]) * c];
  },
  canopyAt: (_x: number, _z: number, h: number, slope: number, w: Splat): number => h < -3 ? 0 : 17 * canopy(w, slope),
  // G222: its exposed boundary (the ~62 m north ridge) is its splat's crag rock, shading darker toward the foot
  cliff: { lip: [0.26, 0.25, 0.23], foot: [0.14, 0.135, 0.125] },
  haze: { colour: [0.55, 0.62, 0.68], near: 400, far: 2400, max: 0.6 },
} as const;
