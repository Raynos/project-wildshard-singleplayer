// SHARD-PLATFORM M3 (look-family rows): the lagoon floor's reef as data (world/Seabed.ts builds it through
// @wildshard/sdk/looks/reefBed): where corals, seaweed and starfish stand, how they are sized, the fish school's place and
// the weld's names. The models are models/reef.ts and models/reefFish.ts.
import type { ReefBedRow } from './lookRows';

/**
 * Lagoon rule: the sand shelf 1.5–8 m under the surface, on gentle slopes (normal y ≥ 0.86 over 1.5 m), 14 m inside the
 * chunk; corals in noise-clustered reefs (denser toward a reef's heart, bigger where the noise is high), seaweed in beds
 * (taller in deeper water), a starfish here and there. The school: 28 fish over the coral with the most corals within 12 m,
 * at 55 % of the water's depth (3 m down at most), on a 7 m loop.
 */
export const SEABED: ReefBedRow = {
  salt: 0x5eab,
  tries: 60,
  margin: 14,
  depth: [1.5, 8],
  normalReach: 1.5,
  minNy: 0.86,
  reefNoise: { seed: 51, freq: 0.02, octaves: 2, offset: 0 },
  bedNoise: { seed: 52, freq: 0.03, octaves: 2, offset: 7 },
  reef: { kind: 'coral', above: 0.12, roll: 0.75, gain: 2.2, base: 0.25, spacing: 1.6, scale: [0.6, 1.5], grow: 0.6 },
  bed: { kind: 'weed', above: 0.05, roll: 0.92, gain: 2.6, base: 0.2, spacing: 1.2, scale: [0.7, 1.4], from: 0.7, full: 4, grow: 0.5 },
  scatter: { kind: 'star', chance: 0.5, spacing: 2.5, scale: [0.5, 0.9] },
  school: { radius: 12, depthShare: 0.55, maxDepth: 3, r: 7, n: 28 },
  // one stream through every copy, in scatter order, across the kinds (the old loop's 0x5ea1 ^ 0xc0)
  buildSeed: 0x5e61,
  schoolSeed: 0xf15c,
  mesh: 'seabed',
  piecePrefix: 'seabed-',
  fishMesh: 'seabed-fish',
  fishPiece: 'reef-fish',
  // the school swims one loop over the reef (an ambient flock wheel; ~0.3 rad/s, wobbling side to side, bobbing)
  swim: { seed: 0xf15d, count: 28, scale: 1, foot: 0, wingbeat: 'fin', flight: { wave: 0, amplitude: 0, pitch: 1, pitchRate: 4, bank: 0.08, bankLimit: 0.3, bankRate: 3 }, wingbeats: { fin: { phase: [1, 1], amplitude: 0, foldPhase: 0, foldAmplitude: 0, rest: [0, 0], rates: [1, 1], glide: [1, 1], beats: [1, 1] } }, perch: null, guide: null, call: null, scavenge: null, visit: null, channels: [['flap', 'fold', 'head', 'legs'], null], attributes: ['aAnim', null], system: { id: 'world.seabed', after: [], before: [] },
    wheeling: { centre: { x: 0, z: 0 }, radius: 7, loops: [[0, 0]], loopRadius: [1, 1], speed: [1.9, 2.4], altitude: [0, 0], bodyScale: [0.8, 1.2], bodyAltitude: [-0.4, 0.4], perchAfter: [1, 1], bank: 0.08, wheel: { xAmplitude: 0.09, xFrequency: 2.3, zScale: 0.8, zAmplitude: 0.07, zFrequency: 1.7, altitudeFrequency: 1.3, altitudeAmplitude: 0, detailFrequency: 1.3, detailAmplitude: 0.5 } } },
};
