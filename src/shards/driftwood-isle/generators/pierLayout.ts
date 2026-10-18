import type { PierParams } from './pierContract';

/** the deck's top at `along` metres from the sea end, own y: flat, then the landing's step-down onto the sand */
export function pierDeckAt(p: PierParams, along: number): number {
  const rampFrom = p.landing?.rampFrom ?? p.length, landY = p.landing?.landY ?? 0;
  if (p.seaRamp !== undefined && along < p.seaRamp.run) return p.seaRamp.landY * (1 - Math.max(0, along) / p.seaRamp.run);
  if (along <= rampFrom) return 0;
  const t = Math.min(1, (along - rampFrom) / Math.max(0.1, p.length - rampFrom));
  return landY * t;
}

/** the deck's half width at `along` metres from the sea end: half the deck, or on a flared sea ramp (SF72) narrowing
 *  straight from half the flare at the sea end to half the deck at the ramp's top */
export function pierHalfWidthAt(p: PierParams, along: number): number {
  const sea = p.seaRamp, half = p.width / 2;
  if (sea === undefined || along >= sea.run) return half;
  const t = Math.max(0, along) / sea.run;
  return sea.flare / 2 + (half - sea.flare / 2) * t;
}

/** where the pilings, the bollards and the landing posts stand, own space ([along, across]; −X side first at each station) */
export function pierPosts(p: PierParams): { posts: [number, number][]; bollards: [number, number][] } {
  const posts: [number, number][] = [], bollards: [number, number][] = [];
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) posts.push([a, s * (pierHalfWidthAt(p, a) + 0.1)]);
  for (const s of [-1, 1]) bollards.push([0.35, s * (pierHalfWidthAt(p, 0.35) + 0.25)]);
  return { posts, bollards };
}
