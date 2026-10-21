import { reefFishGeometry } from './reefFish';
import { DRIFTWOOD_ASSET_NAMES } from './assets';
import SEABED from '../data/seabedLook.json' with { type: 'json' };
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };

/**
 * The lagoon's reef fish school as page life (G571): its draw a posed library over the baked reef fish (the fixed-model
 * template `reefFish`, authored tail-first, so turned half a turn) in the still kit look, and its flock row wheeling
 * about the reef layout's school centre, each fish tinted as laid out.
 */
const geometry = reefFishGeometry(); geometry.computeBoundingBox();
const box = geometry.boundingBox, file = DRIFTWOOD_ASSET_NAMES['fixed:reefFish'];
if (box === null || file === undefined) throw new Error('The fish draw needs its baked template');
export const FISH_DRAW = {
  name: 'driftwood-kit-still', yaw: Math.PI, attributes: [SEABED.swim.attributes[0]], channels: [SEABED.swim.channels[0]],
  assets: { name: 'reef-fish', channels: [{ name: 'position', source: 'position', width: 3 }, { name: 'normal', source: 'normal', width: 3 }, { name: 'color', source: 'color', width: 3 }],
    ranges: [{ kind: 0, start: 0, count: geometry.getAttribute('position').count, box: [...box.min, ...box.max] }] },
  tiers: { phone: { geometry: file }, desktop: { geometry: file } }, models: [],
};
const school = REEF_LAYOUT.school, swim = SEABED.swim;
export const FISH_FLOCK = { id: SEABED.fishMesh, perches: [], packed: false, borrowed: false, audio: 'cue', library: 'look/fish-draw.json',
  row: { ...swim, count: school.n, wheeling: { ...swim.wheeling, centre: { x: school.x, z: school.z }, radius: school.r, altitude: [school.y, school.y] } },
  anchor: { x: school.x, y: school.y, z: school.z }, tints: school.fish.map(fish => fish.colour) } as const;
