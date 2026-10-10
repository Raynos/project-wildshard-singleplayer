import type { DuneFieldRow } from '@wildshard/sdk/looks/duneField';
import { BASIN, CREST_LINES, CRESTS, LANDFORMS, PADS, SPAWN } from './layout';

/**
 * Signal Dunes' crescent dunes (P2) as rows on the SDK's dune field (`@wildshard/sdk/looks/duneField`): 6-12 m knife-edge
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
