// SHARD-PLATFORM M3 (look-family rows): the lagoon floor's reef as the world draws it (world/Seabed.ts): the weld's and
// the school's names and the school's swim (a row on the ambient-flock host, @wildshard/sdk/looks/ambientFlock). Where
// corals, seaweed and starfish stand, and the school's centre and tints, are baked (generators/reefScatter.ts LAGOON_REEF).
import type { AmbientFlockData } from '@wildshard/format/ambientLife';

export const SEABED = {
  mesh: 'seabed',
  fishMesh: 'seabed-fish',
  // the school swims one loop over the reef (an ambient flock wheel; ~0.3 rad/s, wobbling side to side, bobbing). The
  // banks are negative so the school leans the way it did on the old reef bed, which mirrored the roll of its -z fish.
  swim: { seed: 0xf15d, count: 28, scale: 1.25, foot: 0, wingbeat: 'fin', flight: { wave: 0, amplitude: 0, pitch: 1, pitchRate: 4, bank: -0.08, bankLimit: 0.3, bankRate: 3 }, wingbeats: { fin: { phase: [1, 1], amplitude: 0, foldPhase: 0, foldAmplitude: 0, rest: [0, 0], rates: [1, 1], glide: [1, 1], beats: [1, 1] } }, perch: null, guide: null, call: null, scavenge: null, visit: null, channels: [['flap', 'fold', 'head', 'legs'], null], attributes: ['aAnim', null], system: { id: 'world.seabed', after: [], before: [] },
    wheeling: { centre: { x: 0, z: 0 }, radius: 7, loops: [[0, 0]], loopRadius: [1, 1], speed: [1.9, 2.4], altitude: [0, 0], bodyScale: [0.8, 1.2], bodyAltitude: [-0.4, 0.4], perchAfter: [1, 1], bank: -0.08, wheel: { xAmplitude: 0.09, xFrequency: 2.3, zScale: 0.8, zAmplitude: 0.07, zFrequency: 1.7, altitudeFrequency: 1.3, altitudeAmplitude: 0, detailFrequency: 1.3, detailAmplitude: 0.5 } } } satisfies AmbientFlockData,
};
