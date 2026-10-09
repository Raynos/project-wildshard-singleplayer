import type { Piece } from '@wildshard/engine/world/registry';
import type { ShardCube } from '@wildshard/game/shard/context';
import { STRINGS } from '../data/strings';
import { skyBakedPiece } from './baked';

/**
 * SHARD-PLATFORM G200: the timber sky docks at the end of each Rising Islet's lip, standalone only (in a grid cell the road
 * socket continues there and no dock spawns). SF72: built offline (`generators/skyDock.ts` → `baked/docks.glb`), drawn
 * from the bake in two instanced draws (the timber with its per-instance colours restored, the beacon glass); the
 * colliders are the rows' plain boxes.
 */
const FILE = 'src/shards/far-reach/world/skyDock.ts';
const NAMES = ['far.dock.timber', 'far.dock.beacon'] as const;

/** The four docks' look and collision as one piece. */
export function skyDockPiece(): Piece {
  const docks = skyBakedPiece('docks'); docks.root.name = 'far.docks';
  docks.root.children.forEach((mesh, i) => { mesh.name = NAMES[i] ?? mesh.name; });
  return { id: 'far.docks', name: STRINGS.skyDock, category: 'buildings', file: FILE, object: docks.root, colliders: docks.colliders, surface: 'wood' };
}

/** The docks for this session: all four standalone (`cube` null), none in a grid cell (the road socket continues there). */
export function skyDocksFor(cube: ShardCube | null): Piece[] { return cube === null ? [skyDockPiece()] : []; }
