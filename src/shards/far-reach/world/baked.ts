import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakedColliders, bakedKindsGroup, loadBakedKinds } from '@wildshard/game/shardfile/bakedKinds';
import type { Group, InstancedMesh } from 'three';
import winchHouse from '../data/winchHouse.json' with { type: 'json' };
import { BAKED_PIECES, bakedUrl, type BakedPiece } from '../boot/files';
import { shackMaterial, type ShackKind } from './shack';

/**
 * SHARD-PLATFORM SF72: Sky Reach's world pieces drawn from their offline bake. The shapes are built at build time
 * (`generators/*.ts`, `scripts/bake-sky-world.mjs`) and folded into instanced kinds (`@wildshard/sdk/bake/kinds`); the
 * client loads each piece's GLB behind the loading screen and draws it in its own materials: a shack part in its kind's
 * procedural shader (`world/shack.ts`), anything else in its row's standard material. The colliders are the rows'.
 */
const PIECES = { 'winch-house': winchHouse } as const satisfies Readonly<Record<BakedPiece, unknown>>;

const SHACK: readonly ShackKind[] = ['plank', 'shingle', 'stone', 'beam'];
const shackKind = (kind: object): ShackKind | undefined => {
  const name: unknown = 'shack' in kind ? kind.shack : undefined;
  return SHACK.find((k) => k === name);
};

let loaded: ReadonlyMap<BakedPiece, ReadonlyMap<string, InstancedMesh>> = new Map();
/** Load every baked piece (the plugin's `world` hook, before the world is built); a piece that fails to load is empty. */
export async function loadSkyBaked(): Promise<void> {
  const meshes = await Promise.all(BAKED_PIECES.map((piece) => loadBakedKinds(bakedUrl(piece), PIECES[piece].kinds, `far-reach ${piece}`)));
  loaded = new Map(BAKED_PIECES.map((piece, i) => [piece, meshes[i] ?? new Map<string, InstancedMesh>()]));
}

/**
 * A world piece from its bake: its kinds as instanced meshes (undrawn if its GLB did not load) and its baked colliders.
 * `nodes` defaults to the loaded bake (a test passes the GLB's nodes it parsed itself).
 */
export function skyBakedPiece(piece: BakedPiece, nodes: ReadonlyMap<string, InstancedMesh> | undefined = loaded.get(piece)): { root: Group; colliders: ColliderDesc[] } {
  const rows = PIECES[piece];
  const root = bakedKindsGroup(nodes, rows.kinds, {
    material: (kind) => { const shack = shackKind(kind); return shack === undefined ? undefined : shackMaterial(shack); },
    attributes: { _shk: 'shk' },
  });
  return { root, colliders: bakedColliders(rows.colliders) };
}
