/**
 * Build-time only: Signal Dunes' far proxy look (SHARD-PLATFORM SF23), read only by the far baker
 * (scripts/bake/far-proxies.mjs; SF72: a generator, as the template's): warm dusk sand, the dune crests lighter and the lee
 * slopes a shade deeper, under a warm low haze. The grid reads its band and grade from the bake's far.json.
 */
const smooth = (a: number, b: number, t: number): number => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const farLook = {
  family: 'pbr',
  colourAt: (_x: number, _z: number, h: number, slope: number): [number, number, number] => {
    const crest = smooth(8, 24, h), lee = smooth(0.08, 0.3, slope);
    return [0.62 + 0.12 * crest - 0.12 * lee, 0.36 + 0.08 * crest - 0.09 * lee, 0.18 + 0.04 * crest - 0.05 * lee];
  },
  // G222: its exposed boundary is sandstone in its own lee-slope sand, deepening toward the foot
  cliff: { lip: [0.5, 0.27, 0.13], foot: [0.34, 0.18, 0.09] },
  haze: { colour: [0.78, 0.5, 0.36], near: 400, far: 2400, max: 0.55 },
  // SF19b / G94 (Jake: "C Dust-haze band"): under the grid's one sky the dunes keep their dusk through a tall band of warm
  // golden dust rising from the strip at their border, the sand behind it graded dusky orange; no second sky
  grade: { exposure: -0.2, saturation: 1.1, contrast: 1.05, tint: [1.08, 0.94, 0.8] },
  band: { colour: [0.95, 0.45, 0.1], height: 45, opacity: 0.88, own: 0.85 },
} as const;
