/**
 * Sunscar Dunes' far proxy look (SHARD-PLATFORM SF23), read only by the far baker (scripts/bake/far-proxies.mjs): warm
 * dusk sand, the dune crests lighter and the lee slopes a shade deeper, under a warm low haze.
 */
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const farLook = {
  family: 'pbr',
  colourAt: (_x: number, _z: number, h: number, slope: number): [number, number, number] => {
    const crest = smooth(8, 24, h), lee = smooth(0.08, 0.3, slope);
    return [0.62 + 0.12 * crest - 0.12 * lee, 0.36 + 0.08 * crest - 0.09 * lee, 0.18 + 0.04 * crest - 0.05 * lee];
  },
  haze: { colour: [0.78, 0.5, 0.36], near: 400, far: 2400, max: 0.55 },
} as const;
