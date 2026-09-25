/**
 * The pure rules of Pine Hollow's ambient life (PH-M5 / F2), kept out of the scene code so they are unit-tested
 * (test/pine-life.test.ts): where a breadcrumb flock heads, when the ravens come to a kill, when a harvested carcass
 * may go, and the skinning beat's timeline.
 */

export interface PlaceSpot { id: string; x: number; z: number; r: number }

/**
 * The breadcrumb's target: the nearest place the journal has not seen yet (stood in), between `min` and `max` metres
 * from (px, pz), and not one you are standing inside. null = nowhere left to point at (or none in reach).
 */
export function nearestUnvisited(places: readonly PlaceSpot[], visited: (id: string) => boolean, px: number, pz: number, min = 40, max = 450): PlaceSpot | null {
  let best: PlaceSpot | null = null, bd = Infinity;
  for (const p of places) {
    if (visited(p.id)) continue;
    const d = Math.hypot(p.x - px, p.z - pz);
    if (d < Math.max(min, p.r) || d > max) continue;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** the kinds whose carcass draws the ravens (the King, the thralls and the NPCs do not) */
export const RAVEN_CARCASS = new Set(['deer', 'boar', 'elk', 'bear']);
/** seconds from a kill to the ravens' arrival over it: 18–52 s (always inside the minute) */
export const ravenDelay = (u: number): number => 18 + Math.min(1, Math.max(0, u)) * 34;
/** how many ravens come: 2 to a deer or a boar, 3 to an elk or a bear */
export const ravenCount = (kind: string): number => (kind === 'elk' || kind === 'bear' ? 3 : 2);

/** a carcass's ravens: not yet → overhead (circling / waiting) → down (feeding) → gone (they left) */
export type RavenVisit = 'waiting' | 'overhead' | 'feeding' | 'gone';

/**
 * May a harvested carcass fade now? Once the ravens have been and gone; or, when they never came (the flock was busy at
 * another kill, you walked off), `giveUp` seconds after the harvest.
 */
export function carcassMayGo(visit: RavenVisit, sinceHarvest: number, giveUp = 240): boolean {
  return visit === 'gone' || sinceHarvest > giveUp;
}

/** the skinning beat (F2): its length and the moments inside it */
export const BEAT = {
  /** the whole beat, seconds */
  len: 1.5,
  /** kneel: the view dips and pitches down toward the carcass */
  kneelIn: 0.3,
  /** the knife's two strokes (the flesh sound + a small kick each) */
  cuts: [0.42, 0.86] as const,
  /** stand back up from here to the end; the drops land at the end */
  rise: 1.15,
} as const;

/** the beat's envelope at time t (0 → 1 kneeling → 0): eased in over kneelIn, held, eased out from rise */
export function beatEnvelope(t: number): number {
  if (t <= 0 || t >= BEAT.len) return 0;
  const s = (x: number): number => x * x * (3 - 2 * x);
  if (t < BEAT.kneelIn) return s(t / BEAT.kneelIn);
  if (t > BEAT.rise) return s(1 - (t - BEAT.rise) / (BEAT.len - BEAT.rise));
  return 1;
}
