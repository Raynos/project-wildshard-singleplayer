import type { BakedPiece } from './fileInventory';
import type { WorldPieceRow } from '@wildshard/game/shardfile/bakedKinds';
import { skyWorldPieceValues, type SkyWorldPieceRows } from './worldPieceBytes';
import { FALLEN_BRIDGE, MILL, NOTES, STEP, VANES, WINCH, WINCH_HOUSE } from "./layout";
import STRINGS from '../data/strings.json' with { type: 'json' };
import { skyGroundValues } from './groundScene';
import routeScene from '../data/routeScene.generated.json' with { type: 'json' };

const { SKY_GROUND } = skyGroundValues();
const { SKY_ROUTES } = routeScene;
const pieces = skyWorldPieceValues();
function piece(name: BakedPiece): SkyWorldPieceRows {
  const value = pieces.get(name);
  if (value === undefined) throw new Error(`Missing owned Sky world piece ${name}`);
  return value;
}
const mill = piece('mill');
/** Authored static kind, pose, material and collider rows, in their original preload order. */
export const WORLD_BAKES = { 'winch-house': piece('winch-house'), roost: piece('roost'), docks: piece('docks'), crown: piece('crown'), mill: { ...mill, kinds: mill.kinds.map(kind => kind.name.startsWith('cloth-') ? Object.assign(structuredClone(kind), { look: 'mill-canvas' }) : kind) }, 'book-stand': piece('book-stand'),
  knolls: piece('knolls'), geometries: piece('geometries'), 'islet-rig': piece('islet-rig'), dressing: piece('dressing') } as const satisfies Readonly<Record<BakedPiece, unknown>>;


const FILE = 'src/shards/far-reach/world/build.ts';
/**
 * Sky Reach's world pieces as the world registry lists them (G345): the far isles, the pines and the meadow, the updraft
 * ramp (solid only under the board), the fallen crown bridge, the windmill, the winch, the keeper's notes and his stand,
 * the three vanes, the crown arena, and the winch house and the Roost's nest drawn straight from the bake.
 */
export const SKY_PIECES = [
  { id: 'far.docks', name: STRINGS.skyDock, category: 'buildings', file: FILE, surface: 'wood', baked: 'docks', node: 'far.docks' },
  ...SKY_GROUND.registry as readonly WorldPieceRow<BakedPiece>[],
  ...SKY_ROUTES.registry as readonly WorldPieceRow<BakedPiece>[],
  { id: 'far.sky-isles', name: STRINGS.skyIsles, category: 'props', file: FILE },
  { id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE },
  { id: 'far.dressing', name: STRINGS.meadow, category: 'props', file: FILE },
  { id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, surface: 'wood' },
  { id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, surface: 'stone', at: [MILL.x, 30, MILL.z], yaw: MILL.yaw },
  { id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, surface: 'wood', at: [WINCH.x, WINCH.y, WINCH.z] },
  { id: 'far.notes', name: STRINGS.notesName, category: 'props', file: FILE, surface: 'wood', at: [NOTES.x, NOTES.y, NOTES.z], yaw: 0.6 },
  { id: 'far.keeper.stand', name: STRINGS.notesName, category: 'props', file: FILE, surface: 'wood' },
  ...VANES.map((v) => ({ id: `far.vane.${v.id}`, name: STRINGS.vane, category: 'props', file: FILE, surface: 'wood', at: [v.x, v.y, v.z] } as const)),
  { id: 'far.crown.ruin', name: STRINGS.crown, category: 'buildings', file: FILE, surface: 'stone' },
  { id: 'far.step.winch-house', name: STRINGS.winch, category: 'buildings', file: FILE, surface: 'stone', baked: 'winch-house', at: [WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z], node: 'far.step.winch-house' },
  { id: 'far.roost.nest', name: STRINGS.roost, category: 'props', file: FILE, surface: 'wood', baked: 'roost', node: 'far.roost.nest' },
] as const satisfies readonly WorldPieceRow<BakedPiece>[];

/** Fixed placements and baked paint assignment are emitted before client boot. */
function lookKey(kind: SkyWorldPieceRows['kinds'][number], key: 'shack' | 'dressing'): string {
  const value = kind[key];
  if (typeof value !== 'string') throw new Error(`Invalid Sky ${key} look key`);
  return value;
}

export function skyWorldRows(): { readonly bakes: Readonly<Record<string, SkyWorldPieceRows>>; readonly pieces: typeof SKY_PIECES } {
  const dressingLooks: Readonly<Record<string, string>> = { clump: 'dressing-clump', lip: 'dressing-clump', flower: 'dressing-flower', stone: 'dressing-stone' };
  const bakes = Object.fromEntries(Object.entries(WORLD_BAKES).map(([id, row]) => [id, { ...row, kinds: row.kinds.map(kind => 'look' in kind ? kind
    : 'shack' in kind ? { ...kind, look: `shack-${lookKey(kind, 'shack')}` }
    : 'dressing' in kind ? { ...kind, look: dressingLooks[lookKey(kind, 'dressing')] ?? '' } : kind) }]));
  return structuredClone({ bakes, pieces: SKY_PIECES });
}
