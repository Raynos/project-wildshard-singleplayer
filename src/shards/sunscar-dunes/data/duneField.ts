import { BASIN, CREST_LINES, CRESTS, LANDFORMS, PADS, SPAWN } from './layout';

type V2 = readonly [number, number];

/** An authored crest line: a lift along the segment a → b, `w` wide on the windward side and `lee` on the slip side, faded at the ends, a trough behind. */
export interface DuneCrestLine { readonly a: V2; readonly b: V2; readonly lift: number; readonly w: number; readonly lee: number; readonly fade: number; readonly trough: number }
/** An authored polyline crest (x, z, height per point): its faces' widths, which side is the slip face, its end fade. */
export interface DuneLandformCrest { readonly pts: readonly (readonly [number, number, number])[]; readonly w: number; readonly lee: number; readonly leeSide: number; readonly fade: number }
/** A cosine mound. */
export interface DuneMound { readonly x: number; readonly z: number; readonly r: number; readonly h: number }
/** A flat spot levelled to its own dune height plus `lift`, eased out over `ease`. */
export interface DuneSpot { readonly x: number; readonly z: number; readonly r: number; readonly lift: number; readonly ease: number }

/** A crescent dune field as rows. */
export interface DuneFieldRow {
  /** the wind's direction (x, z): the crests run across it */
  readonly wind: { readonly x: number; readonly z: number };
  /** the crests' wavelength (m), the slip face's share of it, the amplitude's cap, and the phase a crest takes at `spawn` */
  readonly wave: number; readonly lee: number; readonly ampMax: number; readonly spawnPhase: number;
  readonly spawn: { readonly x: number; readonly z: number };
  /** the crescent bow (its frequency across the wind and amplitude) and the wander (noise scale and amplitude) */
  readonly warp: { readonly bow: number; readonly bowAmp: number; readonly noise: number; readonly noiseAmp: number };
  /** the amplitude: `base + noise ×` a noise sampled at (v × `v[0]` + `v[1]`, u × `u[0]` + `u[1]`) */
  readonly amp: { readonly base: number; readonly noise: number; readonly v: V2; readonly u: V2 };
  /** the damping: toward the square's edge (from `edge[0]` over `edge[1]` m, by `edge[2]`) and round the basin (over `basin[0]` m past its rim, by `basin[1]`) */
  readonly damp: { readonly edge: readonly [number, number, number]; readonly basin: V2 };
  /** the floor height and a broad relief noise (amplitude, scale, x and z offsets) */
  readonly floor: number;
  readonly relief: { readonly amp: number; readonly scale: number; readonly x: number; readonly z: number };
  /** the basin: its centre, rim radius and flat floor radius; the bowl's floor height and how far past the rim its wall eases */
  readonly basin: { readonly x: number; readonly z: number; readonly r: number; readonly floor: number };
  readonly basinFloor: number; readonly bowlEase: number;
  readonly crestLines: readonly DuneCrestLine[];
  readonly landforms: { readonly crests: readonly DuneLandformCrest[]; readonly mounds: readonly DuneMound[] };
  readonly spots: readonly DuneSpot[];
}

/**
 * Signal Dunes' crescent dunes (P2) as rows on the dune field law (`generators/duneField.ts` bakes it; the client samples the required WSTR grid): 6-12 m knife-edge
 * crests, a gentle windward side, a 28-32° slip face that faces the low key light, so every dune splits into a lit
 * orange face and a cool shaded one. The spawn and the tower stand on broad raised mounds; the caravan and the well on
 * small pads levelled to their own dune height; a wide sand bowl north of the tower for the boss. Every face stays under
 * ~34° (max climb 40°).
 *
 * - wind (P2, review R2): the crests run from far-left to near-right across the spawn view (40° off it). Round 16: the
 *   wind blows toward the spawn view again, so the far faces the camera sees are slip faces in shade, as the mockups draw
 *   them (round 15 flipped it, and the far land right of the tower turned to a pale sheet of lit windward faces).
 * - wave / ampMax (loop 5, the mockups: tall sweeping dunes, 10-30 m; E399: big smooth forms): 1.5× the wave and the
 *   height together, so the slip face keeps its angle; the slip face is the last 0.3 of the wave (≈ 31° at the cap).
 * - spawnPhase: a crest runs through the spawn, so the first frame looks down a slip face over the rows to the tower.
 * - damp: big in the middle, gentler near the square's edge (the entry roads) and round the boss bowl.
 * - basinFloor / bowlEase: the boss arena sits below every dune trough; its wall eases over its rim plus 30 m (the 22 m
 *   dunes would otherwise wall it at 46°).
 * - landforms (round 14, the lead): the field is pulled up to an authored crest by its face profile only, so past the
 *   faces the dune sea keeps its own relief; spots: the pads ease out over 4.6 × their radius (at least 46 m).
 */
export const DUNE_FIELD: DuneFieldRow = {
  wind: { x: -0.643, z: 0.766 }, wave: 150, lee: 0.3, ampMax: 24, spawnPhase: 0.69, spawn: { x: SPAWN.x, z: SPAWN.z },
  warp: { bow: 0.0225, bowAmp: 14, noise: 0.0035, noiseAmp: 18 },
  amp: { base: 19, noise: 6.4, v: [0.006, 7], u: [0.002, -3] },
  damp: { edge: [125, 55, 0.6], basin: [60, 0.45] },
  floor: 2, relief: { amp: 3.5, scale: 0.0024, x: -11, z: 5 },
  basin: { x: BASIN.x, z: BASIN.z, r: BASIN.r, floor: BASIN.floor }, basinFloor: 0.8, bowlEase: 30,
  crestLines: CREST_LINES, landforms: LANDFORMS,
  spots: [...CRESTS.map((c) => ({ x: c.x, z: c.z, r: c.r, lift: c.lift, ease: c.ease })), ...PADS.map((p) => ({ x: p.x, z: p.z, r: p.r, lift: p.lift ?? 0, ease: p.ease ?? Math.max(p.r * 4.6, 46) }))],
};

/** Exact retained hollow/crest tint; author and client share its ring radius. */
export const SAND_TINT = { sand: [0.5, 0.23, 0.075], hollow: [0.22, 0.14, 0.12], crest: [0.64, 0.33, 0.1], ring: 14, span: 2.5, hollowGain: 0.75, crestGain: 0.6, skirtHollow: 0.25 } as const;
