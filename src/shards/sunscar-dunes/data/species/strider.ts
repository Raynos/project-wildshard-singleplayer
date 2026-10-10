import type { SpeciesData, StrikeData } from '@wildshard/sdk/species';
import { STRINGS } from '../strings';
import type { SpeciesClips } from '@wildshard/sdk/species/clips';
import type { QuadrupedLookRow } from '@wildshard/sdk/looks/fittedHull';

export const STRIDE = { notice: 24, charge: 17, walk: 1.1, approach: 2.4, homeR: 16, lose: 40, face: 0.7 } as const;

export const CHARGE_DATA: StrikeData = { id: 'sunscar.strider.charge', shape: { kind: 'lane', length: 13, width: 2.2 }, windup: 1.1, active: 1.2, recover: 1.8, cooldown: 3.5,
  range: STRIDE.charge, damage: 22, tags: ['creature.duneStrider'], motion: { speed: 11, overshoot: 3 }, weight: { kind: 'horizontal-distance', above: 5, far: 2, near: 0.2 } };

export const HORNS_DATA: StrikeData = { id: 'sunscar.strider.horns', shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 }, windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.6,
  range: 3.2, damage: 12, tags: ['creature.duneStrider'], weight: { kind: 'constant', value: 1 } };

export const DUNE_STRIDER: SpeciesData = { id: 'sunscar.creature.duneStrider', kind: 'duneStrider', label: STRINGS.strider, aggressive: true, lockable: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.strider, weight: 1, rarity: 'uncommon', scale: [0.95, 1.1], hp: 150 }] };

/** The strider's gait weight: full by 2 m/s, a longer swing at a charge (above 6 m/s). */
const GAIT = { gait: 2, run: 6, fast: 0.75, slow: 0.45 } as const;
const SWING = { wave: 'phase', rate: Math.PI * 2 } as const;
const PAWING = { mem: { key: 'paw', above: 0 } } as const;
/** The strider's clips (SHARD-PLATFORM M3): legs, a winded body that sags and a pawing head that dips, the dead collapse. */
export const STRIDER_CLIPS: SpeciesClips = [
  // The legs swing in diagonal pairs with the gait; pawing, the near fore lifts and stamps (alive or not); dead, they splay.
  { bone: 'legFL', channel: 'rotation.x', cases: [{ when: PAWING, sum: [-0.9, { of: [{ wave: 't', rate: 9, abs: true }, 0.9] }] },
    { when: { alive: true }, sum: [{ of: [SWING, GAIT] }] }, { sum: [-0.3] }] },
  { bone: 'legFL', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [0] }, { sum: [{ of: [0.9, { death: true }] }] }] },
  { bone: 'legFR', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [SWING, GAIT, -1] }] }, { sum: [-0.3] }] },
  { bone: 'legFR', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [0] }, { sum: [{ of: [-0.9, { death: true }] }] }] },
  { bone: 'legBL', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [SWING, GAIT, -1] }] }, { sum: [-0.3] }] },
  { bone: 'legBL', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [0] }, { sum: [{ of: [0.9, { death: true }] }] }] },
  { bone: 'legBR', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [SWING, GAIT] }] }, { sum: [-0.3] }] },
  { bone: 'legBR', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [0] }, { sum: [{ of: [-0.9, { death: true }] }] }] },
  { bone: 'body', channel: 'position.y', bind: 'bodyY', cases: [{ when: { alive: true }, sum: [{ of: [{ mem: 'winded' }, -0.25] }] }, { sum: [{ of: [-1.2, { death: true }] }] }] },
  { bone: 'body', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [0] }, { sum: [{ of: [0.25, { death: true }] }] }] },
  { bone: 'head', channel: 'rotation.x', cases: [
    { when: { alive: true }, sum: [{ when: PAWING, of: [0.35] }, { of: [{ mem: 'winded' }, 0.5] }, { of: [{ wave: 't', rate: 1.3 }, 0.05] }] }, { sum: [0.7] }] },
  { bone: 'tail', channel: 'rotation.y', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2.1 }, 0.3] }] }, { sum: [0] }] },
];

/** The strider's look on its fitted hull (data/species/hulls.ts STRIDER_HULL): its rig contract and dims (body height and leg length as shares of the hull's height). */
export const STRIDER_LOOK: QuadrupedLookRow = { id: 'sunscar.look.duneStrider', species: DUNE_STRIDER.id, kind: 'duneStrider',
  skeleton: 'sunscar.duneStrider', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'], clipNames: ['idle', 'walk', 'attack', 'hit', 'die'],
  dims: { bodyY: 0.7, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: 0.5, halfWidth: 0.7 } };
