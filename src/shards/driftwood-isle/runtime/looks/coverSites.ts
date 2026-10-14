import type { CoverSite } from './streamedCover';

/** Ground measurements shared by live cover placement and its offline tint grid. */
export interface Site extends CoverSite { td: number; sd: number; palm: number }
type Density = (s: Site) => number;

export const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const beach = (h: number): number => ss(0.5, 1.2, h) * (1 - ss(2.0, 3.2, h));
const grass = (h: number, slope: number) => ss(2.6, 4.2, h) * (1 - ss(0.18, 0.26, slope));
const off = (td: number) => ss(2.6, 4.0, td);
const jungle = (sd: number) => 1 - ss(18, 45, sd);
/** the sand -> grass edge (the plant fringe) and the dune crest (beach grass) */
const edge = (h: number, sl: number): number => ss(1.9, 2.7, h) * (1 - ss(4.8, 7, h)) * (1 - ss(0.2, 0.3, sl));
const dune = (h: number): number => ss(1.2, 1.8, h) * (1 - ss(2.6, 3.4, h));

/** each kind's instances per candidate × 2 at a site (by the rows' names) */
export const DENSITY: Readonly<Record<string, Density>> = {
  tuft: (s) => (grass(s.h, s.slope) * 1.6 + beach(s.h) * 0.18 + dune(s.h) * 0.7) * off(s.td),
  fern: (s) => (grass(s.h, s.slope) * (0.03 + jungle(s.sd) * 0.35) + edge(s.h, s.slope) * 0.45 + s.palm * 0.45) * off(s.td),
  hibiscus: (s) => (grass(s.h, s.slope) * (0.025 + jungle(s.sd) * 0.08) + edge(s.h, s.slope) * 0.3 + s.palm * 0.28) * off(s.td),
  daisy: (s) => (grass(s.h, s.slope) * 0.07 + edge(s.h, s.slope) * 0.3) * off(s.td),
  pebble: (s) => (grass(s.h, s.slope) * 0.03 + beach(s.h) * 0.05) * (0.4 + 0.6 * off(s.td)),
  // (E43) the beach: a shell / starfish / pebble scatter every 1-2 m on the sand, beach grass on the dune crest, and a
  // dense fringe of ferns, hibiscus, flowers and bushes along the sand -> grass edge and round every palm's foot
  shells: (s) => beach(s.h) * 0.8,
  starfish: (s) => beach(s.h) * 0.09,
  bush: (s) => (edge(s.h, s.slope) * 0.3 + s.palm * 0.3 + grass(s.h, s.slope) * 0.015) * off(s.td) + jungle(s.sd) * grass(s.h, s.slope) * 0.06,
};
