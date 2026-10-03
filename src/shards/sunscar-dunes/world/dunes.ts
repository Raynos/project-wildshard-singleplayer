import type { TerrainNoise } from '#engine/data';
import { BASIN, CREST_LINES, CRESTS, PADS, SPAWN } from '../layout';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
/**
 * The wind (P2, review R2): it blows along `WIND` (x, z), so the crests run from far-left to near-right across the
 * spawn view (40° off it) and every slip face turns toward the key light, behind-left of the spawn view (style bible). Wavelength `WAVE` m; the lee (slip face) is the last `LEE` of it.
 */
export const WIND = { x: -0.643, z: 0.766 } as const;
// loop 5 (the mockups: tall sweeping dunes, 10-30 m): 1.5x the wave and the height together, so the slip face keeps its
// angle (every face stays under the player's max climb)
const WAVE = 128, LEE = 0.45, AMP_MAX = 22, SPAWN_P = 0.55; // E399: the mockups' dunes are big smooth forms (10-30 m)
/** The warped wind coordinate: crest lines bowed into crescents and wandering, so none read as parallel stripes. */
const warped = (x: number, z: number, n: TerrainNoise['n']): number =>
  x * WIND.x + z * WIND.z + Math.cos((-x * WIND.z + z * WIND.x) * 0.0225) * 14 + n.get(x * 0.0035, z * 0.0035) * 18;
/** u at the spawn minus the stoss: puts a crest through the spawn (per noise field). */
const phases = new WeakMap<TerrainNoise['n'], number>();
const phaseOf = (n: TerrainNoise['n']): number => {
  let p = phases.get(n); if (p === undefined) { p = warped(SPAWN.x, SPAWN.z, n) - SPAWN_P * WAVE; phases.set(n, p); }
  return p;
};
/** The basin's sand floor (metres): the boss arena sits below every dune trough. */
export const BASIN_FLOOR = 0.8;
/** How far past its rim (metres) the bowl's wall eases into the dunes. */
const BOWL_EASE = 30;

/** Stoss (windward) rise 0 → 1: eased out of the trough, still climbing at the crest so the crest is a knife edge. */
const stoss = (t: number): number => t * t * (2 - t);
/** Lee (slip face) fall 1 → 0: near-linear, so its steepest is only 1.15 × its mean (≈ 31° at `AMP_MAX`). */
const lee = (s: number): number => 1 - (0.7 * s + 0.3 * smooth(s));

/** The crest lines' lift at (x, z) (layout CREST_LINES). */
function crestLines(x: number, z: number): number {
  let lift = 0;
  for (const c of CREST_LINES) {
    const [ax, az] = c.a, [bx, bz] = c.b, dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    // which side: the cross product's sign against the segment (west is the side with the smaller x across it)
    const side = dx * (z - az) - dz * (x - ax), width = side > 0 ? c.w : c.lee;
    const ends = smooth(t / c.fade) * smooth((1 - t) / c.fade);
    lift = Math.max(lift, c.lift * (1 - smooth(d / width)) * ends);
  }
  return lift;
}

/** One field of barchan-like crescent dunes: transverse crests bowed into crescents, amplitude varying along them. */
function field(x: number, z: number, n: TerrainNoise['n']): { h: number; amp: number } {
  const u0 = x * WIND.x + z * WIND.z, v = -x * WIND.z + z * WIND.x;
  // Phased so a crest runs through the spawn: the first frame looks down a slip face over the rows to the tower.
  const w = (warped(x, z, n) - phaseOf(n)) / WAVE, p = w - Math.floor(w);
  const ridge = p < 1 - LEE ? stoss(p / (1 - LEE)) : lee((p - (1 - LEE)) / LEE);
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const db = Math.hypot(x - BASIN.x, z - BASIN.z);
  // Big in the middle, gentler near the square's edge (the entry roads) and round the boss bowl.
  const damp = (1 - 0.6 * smooth((edge - 125) / 55)) * (1 - 0.45 * (1 - smooth((db - BASIN.r) / 60)));
  const amp = Math.min(AMP_MAX, 19 + 6.4 * n.get(v * 0.006 + 7, u0 * 0.002 - 3)) * damp;
  return { h: 2 + amp * ridge + 3.5 * n.get(x * 0.0024 - 11, z * 0.0024 + 5) * damp + crestLines(x, z), amp };
}

/** Flat spots levelled to their own dune height (+ `lift`), eased out over 2.4 × `r`. */
const SPOTS = [...CRESTS.map((c) => ({ x: c.x, z: c.z, r: c.r, lift: c.lift, ease: c.ease })), ...PADS.map((p) => ({ x: p.x, z: p.z, r: p.r, lift: p.lift ?? 0, ease: Math.max(p.r * 4.6, 46) }))];
const spotLevels = new WeakMap<TerrainNoise['n'], number[]>();

/**
 * Crescent dunes (P2): 6–12 m knife-edge crests 64 m apart, a gentle windward side, a 28–32° slip face that faces the
 * low key light, so every dune splits into a lit orange face and a cool shaded one. The spawn and the tower stand on
 * broad raised mounds; the caravan and the well on small pads levelled to their own dune height; a wide sand bowl
 * north of the tower for the boss. The trails are graded in (`manifest.ground.terrain.graded`). Every face stays under
 * ~34° (max climb 40°).
 */
export function duneHeight(x: number, z: number, { n }: TerrainNoise): number {
  let { h } = field(x, z, n);
  let levels = spotLevels.get(n);
  if (levels === undefined) { levels = SPOTS.map((p) => field(p.x, p.z, n).h + p.lift); spotLevels.set(n, levels); }
  for (const [i, p] of SPOTS.entries()) {
    const d = Math.hypot(x - p.x, z - p.z); if (d > p.r + p.ease) continue;
    h += ((levels[i] ?? h) - h) * (1 - smooth((d - p.r) / p.ease));
  }
  const db = Math.hypot(x - BASIN.x, z - BASIN.z);
  // the bowl's wall eases over its rim plus BOWL_EASE m: the 22 m dunes would otherwise wall it at 46 deg
  if (db < BASIN.r + BOWL_EASE) h += (BASIN_FLOOR - h) * (1 - smooth((db - BASIN.floor) / (BASIN.r + BOWL_EASE - BASIN.floor)));
  return h;
}
