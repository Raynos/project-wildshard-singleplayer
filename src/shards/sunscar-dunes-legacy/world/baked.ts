import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakedColliders, bakedKindsGroup, loadBakedKinds, type BakedColliderRow, type BakedKindRow } from '@wildshard/game/shardfile/bakedKinds';
import type { Group, InstancedMesh } from 'three';
import rocks from '../data/rocks.json' with { type: 'json' };
import dressing from '../data/dressing.json' with { type: 'json' };
import tower from '../data/tower.json' with { type: 'json' };
import caravan from '../data/caravan.json' with { type: 'json' };
import well from '../data/well.json' with { type: 'json' };
import { BAKED_PIECES, bakedUrl, type BakedPiece } from '../boot/files';
import { warmByFire } from './meshes';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' world pieces drawn from their offline bake.
 * The shapes are built at build time (`generators/*.ts`, `scripts/bake-signal-world.mjs`); the client reads each piece's
 * static GLB and its rows through the SDK's baked-kinds loader (`@wildshard/game/shardfile/bakedKinds`) and only adds its
 * own lighting: a kind marked `warm` is lit by the fires. The colliders never wait on the GLB.
 */
interface KindRow extends BakedKindRow { readonly warm?: boolean }
interface PieceRows { kinds: readonly KindRow[]; colliders: readonly BakedColliderRow[] }
const PIECES: Readonly<Record<BakedPiece, PieceRows>> = { rocks, dressing, tower, caravan, well };

/** A loaded bake: each piece's instanced meshes (their geometry and transforms), keyed by the kind's name. */
export type BakedWorld = ReadonlyMap<BakedPiece, ReadonlyMap<string, InstancedMesh>>;

let last: BakedWorld | null = null;
/** Load every baked piece behind the loading screen (the plugin's `world` hook); a piece that fails to load is empty. */
export async function loadBakedWorld(): Promise<BakedWorld> {
  const names = BAKED_PIECES, loaded = await Promise.all(names.map((piece) => loadBakedKinds(bakedUrl(piece), PIECES[piece].kinds, `sunscar-dunes ${piece}`)));
  last = new Map(names.map((name, i) => [name, loaded[i] ?? new Map<string, InstancedMesh>()]));
  return last;
}
/** The bake loaded last (the Model Explorer's specimens draw from it), or null before the first load. */
export const lastBakedWorld = (): BakedWorld | null => last;

/** A world piece from its bake: each kind one `InstancedMesh` in its own material, and the baked colliders. */
export function bakedPiece(baked: BakedWorld, piece: BakedPiece): { root: Group; colliders: ColliderDesc[] } {
  const rows = PIECES[piece];
  // the lantern and the cookfire light a `warm` kind
  const root = bakedKindsGroup(baked.get(piece), rows.kinds, { decorate: (material, kind) => { if (kind.warm === true) warmByFire(material); } });
  return { root, colliders: bakedColliders(rows.colliders) };
}
