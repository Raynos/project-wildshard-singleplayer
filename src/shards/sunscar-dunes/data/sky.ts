import type { DuskDomeStyle } from '@wildshard/sdk/looks/duskDome';

/**
 * Signal Dunes' procedural dusk dome as a row (SHARD-PLATFORM SF72, look-family rows) on the platform's dome
 * (`@wildshard/sdk/looks/duskDome`), authored in sRGB (style bible "Last Light"): a tall band (orange at the glow, rose
 * away from it) → dusty mauve → a greyed violet → a slate-indigo zenith, thin under-lit cloud streaks over the band side
 * and the first stars. The painted skies replace it once they load (`look/painted.ts`); it is the sky until then.
 */
export const SKY_STYLE: DuskDomeStyle = {
  // the sun 4° under the horizon just right of the signal tower (round 9: mockup A's afterglow peaks right of it); the key
  // light is art-directed apart from it (look/render.ts KEY)
  sun: [0.2, -0.07, -0.98],
  // Loop 5 / rounds 8b-14 (measured, Rec. 709 bands against the mockups): a deeper, redder afterglow that holds as the dusk
  // deepens, keeping some blue (the dome's gamma crushed a 0.19 blue to ~0)
  band: { away: [0.64, 0.34, 0.29], toward: [0.78, 0.38, 0.26], power: 1.2, gain: [0.42, 0.66] },
  // round 8: a dusty rose-peach above the band and a bluer, less plum dome; E399: as the quest goes on the rose turns
  // violet, the mid sky a lighter lavender (mockup D), the indigo comes down a touch bluer (mockup B)
  rose: { early: [0.44, 0.29, 0.3], late: [0.42, 0.3, 0.42] },
  mid: { early: [0.24, 0.2, 0.29], late: [0.27, 0.22, 0.41] },
  zenith: { early: [0.1, 0.09, 0.19], late: [0.15, 0.155, 0.31] },
  // round 10 (R9B-5: the mockup's hot spot right of the tower)
  glow: { colour: [1, 0.56, 0.34], power: 9, gain: 0.36 },
  // rounds 10-11: late dusk only, a broad peach band ~3° (mockup D)
  horizon: { colour: [0.95, 0.62, 0.42], gain: 0.4 },
  // E399 / rounds 8-12 (mockups A and dusk-fire: broken, layered banks beside the glow, lit orange-gold from below; past
  // 1, as the dome's gamma and AgX wash a 1.0 orange to dusty pink); B-D are clear, so the deck clears with the dusk
  clouds: { lit: [1.25, 0.46, 0.22], litHot: [1.3, 0.56, 0.24], litEdge: [1.3, 0.7, 0.36], dark: [0.2, 0.15, 0.22], darkHot: [0.3, 0.17, 0.16], clearBy: [0.03, 0.14] },
  // round 9 (seat C: the mockups' stars crisp white points): fewer, larger, brighter
  stars: { colour: [0.9, 0.92, 1], density: 0.9955, gain: [2.2, 2.6] },
  // a smooth gradient this dark crossed one 8-bit step in a visible line across the sky (the scorer's arc)
  dither: 0.014,
  gamma: 2.2,
};
