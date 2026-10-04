/**
 * Sky Reach's far proxy look (SHARD-PLATFORM SF23), read only by the far baker (scripts/bake/far-proxies.mjs): toon
 * sky isles (grass tops, stone flanks) standing out of the painted cloud sea, a bright sheet at its level (−8,
 * `PAINTED_SEA.y`) that hides the void beneath them.
 */
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const farLook = {
  family: 'toon',
  colourAt: (x: number, z: number, h: number, slope: number): [number, number, number] => {
    const rock = Math.max(smooth(0.3, 0.45, slope), smooth(-2, -12, h)), k = 0.94 + 0.06 * Math.sin(x * 0.09 + z * 0.07);
    return [(0.3 + (0.42 - 0.3) * rock) * k, (0.55 + (0.4 - 0.55) * rock) * k, (0.18 + (0.42 - 0.18) * rock) * k];
  },
  water: { level: -8, colour: [0.86, 0.88, 0.93] },
  haze: { colour: [0.7, 0.8, 0.95], near: 500, far: 2800, max: 0.5 },
} as const;
