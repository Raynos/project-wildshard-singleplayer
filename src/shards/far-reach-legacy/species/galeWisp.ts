import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { IcosahedronGeometry, OctahedronGeometry, TorusGeometry } from 'three';
import { STRINGS } from '../data/strings';
import { hull } from './rig';

/** The burst: the wisp darts at the chest and bursts in a small sphere that shoves you back (G24 `WISP.shove`). */
export const BURST: StrikeSpec = { id: 'far.wisp.burst', shape: { kind: 'sphere', radius: 1.4 }, windup: 0.7, active: 0.7, recover: 1.2, cooldown: 3.5,
  range: 9, damage: 6, tags: ['creature.galeWisp'], units: 'world', weight: () => 1 };
export const WISP = { circle: 5, dart: 13, notice: 14, shove: 7, lift: 2.5 } as const;
export const GALE_WISP: SpeciesRow = { id: 'far.creature.galeWisp', kind: 'galeWisp', label: STRINGS.wisp, aggressive: true, blood: false,
  flight: { altitude: 33, above: 'world', climbRate: 8, diveRate: 10, lockRange: 20 },
  variants: [{ id: 'gale', label: STRINGS.wisp, weight: 1, rarity: 'common', scale: [1, 1], hp: 18 }] };

export const GALE_WISP_LOOK: SpeciesLook = { id: 'far.look.galeWisp', species: GALE_WISP.id, kind: 'galeWisp', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.galeWisp', sockets: ['body', 'head', 'swirl'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }, { name: 'head', parent: 'body', pos: [0, 0.1, 0.2] }, { name: 'swirl', parent: 'body', pos: [0, 0, 0] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(0.45, 0), bone: 0, color: 0xeaf8ff },
      { geometry: new OctahedronGeometry(0.2, 0), bone: 1, color: 0x9fe6f2, at: [0, 0.1, 0.32] },
      { geometry: new TorusGeometry(0.75, 0.05, 3, 10), bone: 2, color: 0xcdeff8, rot: [Math.PI / 2, 0, 0] },
      { geometry: new TorusGeometry(0.55, 0.04, 3, 8), bone: 2, color: 0xffffff, rot: [Math.PI / 2.6, 0.4, 0] },
    ])],
    dims: { bodyY: 0, bodyHalfLen: 0.4, bodyRadius: 0.45, headRadius: 0.2, legLen: 0.1, feet: [], halfWidth: 0.75 } }),
  animate: ({ bones, t, alive }) => { const swirl = bones['swirl'], body = bones['body'];
    if (swirl) swirl.rotation.y = t * (alive ? 6 : 1); if (body) body.scale.setScalar(alive ? 1 + Math.sin(t * 7) * 0.08 : 0.5); },
};
