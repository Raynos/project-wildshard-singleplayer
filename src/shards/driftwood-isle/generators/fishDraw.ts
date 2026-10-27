import { reefFishGeometry } from './reefFish';
import { DRIFTWOOD_ASSET_NAMES } from './assets';
import SEABED from '../data/seabedLook.json' with { type: 'json' };
import { driftwoodReefBank } from './reefBank';

/**
 * The lagoon's reef fish school as page life (G571): its draw a posed library over the baked reef fish (the fixed-model
 * template `reefFish`, authored tail-first, so turned half a turn) in the still kit look, and its flock row wheeling
 * about the reef layout's school centre, each fish tinted as laid out.
 */
const geometry = reefFishGeometry(); geometry.computeBoundingBox();
const box = geometry.boundingBox, file = DRIFTWOOD_ASSET_NAMES['fixed:reefFish'];
if (box === null || file === undefined) throw new Error('The fish draw needs its baked template');
export const FISH_DRAW: { name: string; yaw: number; attributes: (string | null | undefined)[]; channels: (string[] | null | undefined)[]; assets: { name: string; channels: { name: string; source: string; width: number; }[]; ranges: { kind: number; start: number; count: number; box: number[]; }[]; }; tiers: { phone: { geometry: string; }; desktop: { geometry: string; }; }; models: never[]; } = {
  name: 'driftwood-kit-still', yaw: Math.PI, attributes: [SEABED.swim.attributes[0]], channels: [SEABED.swim.channels[0]],
  assets: { name: 'reef-fish', channels: [{ name: 'position', source: 'position', width: 3 }, { name: 'normal', source: 'normal', width: 3 }, { name: 'color', source: 'color', width: 3 }],
    ranges: [{ kind: 0, start: 0, count: geometry.getAttribute('position').count, box: [...box.min, ...box.max] }] },
  tiers: { phone: { geometry: file }, desktop: { geometry: file } }, models: [],
};
const school = driftwoodReefBank().layout.school, swim = SEABED.swim;
if (school === undefined) throw new Error('The lagoon layout has no fish school');
export const FISH_FLOCK: { readonly id: string; readonly perches: readonly []; readonly packed: false; readonly borrowed: false; readonly audio: "cue"; readonly library: "look/fish-draw.json"; readonly row: { readonly count: number; readonly wheeling: { readonly centre: { readonly x: number; readonly z: number; }; readonly radius: number; readonly altitude: readonly [number, number]; readonly loops: number[][]; readonly loopRadius: number[]; readonly speed: number[]; readonly bodyScale: number[]; readonly bodyAltitude: number[]; readonly perchAfter: number[]; readonly bank: number; readonly wheel: { xAmplitude: number; xFrequency: number; zScale: number; zAmplitude: number; zFrequency: number; altitudeFrequency: number; altitudeAmplitude: number; detailFrequency: number; detailAmplitude: number; }; }; readonly seed: number; readonly scale: number; readonly foot: number; readonly wingbeat: string; readonly flight: { wave: number; amplitude: number; pitch: number; pitchRate: number; bank: number; bankLimit: number; bankRate: number; }; readonly wingbeats: { fin: { phase: number[]; amplitude: number; foldPhase: number; foldAmplitude: number; rest: number[]; rates: number[]; glide: number[]; beats: number[]; }; }; readonly perch: null; readonly guide: null; readonly call: null; readonly scavenge: null; readonly visit: null; readonly channels: (string[] | null)[]; readonly attributes: (string | null)[]; readonly system: { id: string; after: never[]; before: never[]; }; }; readonly anchor: { readonly x: number; readonly y: number; readonly z: number; }; readonly tints: number[]; } = { id: SEABED.fishMesh, perches: [], packed: false, borrowed: false, audio: 'cue', library: 'look/fish-draw.json',
  row: { ...swim, count: school.n, wheeling: { ...swim.wheeling, centre: { x: school.x, z: school.z }, radius: school.r, altitude: [school.y, school.y] } },
  anchor: { x: school.x, y: school.y, z: school.z }, tints: school.fish.map(fish => fish.colour) } as const;
