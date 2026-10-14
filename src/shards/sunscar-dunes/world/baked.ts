import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakedMeshWorld, worldPieces, type BakedMeshKindRow, type LoadedMeshBake, type WorldPieces } from '@wildshard/game/shardfile/bakedKinds';
import type { Group, MeshStandardMaterial, Object3D } from 'three';
import { SIGNAL_PIECES } from '../data/pieces';
import rocks from '../data/rocks.json' with { type: 'json' };
import dressing from '../data/dressing.json' with { type: 'json' };
import tower from '../data/tower.json' with { type: 'json' };
import caravan from '../data/caravan.json' with { type: 'json' };
import well from '../data/well.json' with { type: 'json' };
import lash from '../data/lash.json' with { type: 'json' };
import braziers from '../data/braziers.json' with { type: 'json' };
import { BAKED_URLS, WORLD_BYTES, type BakedPiece } from '../data/files';
import { warmByFire } from './meshes';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' world pieces drawn from their offline bake.
 * The shapes are built at build time (`generators/*.ts`, `scripts/bake-signal-world.mjs`); the client reads each piece's
 * static GLB and its rows through the game's baked-world rows (`@wildshard/game/shardfile/bakedKinds`) and only adds its
 * own lighting: a kind marked `warm` is lit by the fires. The colliders never wait on the GLB.
 */
interface KindRow extends BakedMeshKindRow { readonly warm?: boolean; readonly brazier?: number }
const WORLD = bakedMeshWorld<BakedPiece, KindRow>({ rocks, dressing, tower, caravan, well, braziers, lash }, BAKED_URLS, 'sunscar-dunes',
  { resources: WORLD_BYTES, readBytes: fetchDeflated, decorate: (material, kind) => { if (kind.warm === true) warmByFire(material); } });

/** A loaded bake: each piece's instanced meshes (their geometry and transforms), keyed by the kind's name. */
export type BakedWorld = LoadedMeshBake<BakedPiece>;
/** Load the declared mesh world and its companion texels behind the loading screen. */
export const loadBakedWorld = WORLD.load;
/** The held coil borrows the declared plait bytes after the same world preload. */
export const lastPlait = (): Uint8Array | null => WORLD.bytes('plait');
/** The bake loaded last (the Model Explorer's specimens draw from it), or null before the first load. */
export const lastBakedWorld = WORLD.last;

/** A world piece from its bake: each kind one `InstancedMesh` in its own material; `only` picks some kinds (one waymark's), `each` sees their materials. */
export function bakedPiece(baked: BakedWorld, piece: BakedPiece, only?: (kind: KindRow) => boolean, each?: (material: MeshStandardMaterial) => void): { root: Group; colliders: ColliderDesc[] } {
  return WORLD.piece(piece, { nodes: baked.get(piece) ?? new Map(), only, each });
}
/** Signal's world pieces (data/pieces.ts) placed under `root` and registered, the baked ones drawn from `baked`. */
export const signalPieces = (register: Parameters<typeof worldPieces>[0], root: Object3D, baked: BakedWorld): WorldPieces => worldPieces(register, root, SIGNAL_PIECES, (piece) => bakedPiece(baked, piece), braziers.braziers.map((row,index)=>({id:`sunscar.brazier.${String(index)}`,colliders:row.colliders})));
