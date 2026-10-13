import type { SpeciesData, StrikeData } from '@wildshard/sdk/species';
import { STRINGS } from '../strings';
import type { SpeciesClips } from '@wildshard/sdk/species/clips';

export const RAY = { glideAlt: 14, glideSpeed: 9, circleR: 20, patrolR: 34, patrolAlt: 22, notice: 55, diveFrom: 38, diveSpeed: 15, climbAlt: 17, climbFor: 2.6, diveMax: 4.5, rest: 3 } as const;

export const SWOOP_DATA: StrikeData = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3, active: 0.4, recover: 0.5, cooldown: 2.5,
  range: 7, damage: 14, tags: ['creature.duneRay'], units: 'world', weight: { kind: 'constant', value: 1 } };

export const DUNE_RAY: SpeciesData = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, lockable: true, blood: false,
  // A generous lock (sol-lock, Jake): the ray circles 10–18 m up and swoops from further out than a ground creature.
  flight: { altitude: RAY.glideAlt, above: 'ground', climbRate: 6, diveRate: 24, lockRange: 34 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1.15], hp: 70 }] };

/** The ray's clips (SHARD-PLATFORM M3): a steady wingbeat and a lazy tail; dead, the wings droop. */
export const RAY_CLIPS: SpeciesClips = [
  { bone: 'wingL', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2.4 }, -0.32] }] }, { sum: [0.5] }] },
  { bone: 'wingR', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2.4 }, 0.32] }] }, { sum: [-0.5] }] },
  { bone: 'tail', channel: 'rotation.y', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 1.7 }, 0.25] }] }, { sum: [0] }] },
];

/** The ray's look rows (species/duneRay.ts): its rig contract. The Matriarch's body rides the same skeleton. */
export const RAY_LOOK = { id: 'sunscar.look.duneRay', species: DUNE_RAY.id, kind: 'duneRay', skeleton: 'sunscar.duneRay',
  sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clipNames: ['idle', 'fly', 'attack', 'hit', 'die'] } as const;
/** The ray's skeleton (absolute bind space, +Z forward: body first, then head, the two wings and the tail) and size: baked
 *  beside the manta's skin (generators/hulls.ts) for the ray and the Matriarch, and their stand-in when a rig did not load. */
export const RAY_BODY = {
  bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, 1.2] },
    { name: 'wingL', parent: 'body', pos: [-0.9, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [0.9, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, -1.0] }],
  dims: { bodyY: 0.3, bodyHalfLen: 1.1, bodyRadius: 0.8, headRadius: 0.4, legLen: 0, halfWidth: 2.6 },
} as const;
