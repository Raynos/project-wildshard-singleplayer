import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import BRIDGE_PHYSICS from '../data/bridgePhysics.generated.json' with { type:'json' };
import PLACEMENTS from '../data/physicsPlacements.generated.json' with { type:'json' };
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakedMeshWorld, worldPieces, type BakedMeshKindRow, type DrawnBakedMeshPiece, type WorldPieces } from '@wildshard/game/shardfile/bakedKinds';
import { BufferGeometry, type Mesh, type Object3D } from 'three';
import { SKY_PIECES } from '../data/pieces';
import { WORLD_BAKES, SKY_KNOLL_HULLS } from '../data/worldBakes';
import { BAKED_URLS, WORLD_BYTES, type BakedPiece } from '../data/files';
import { shackMaterial, type ShackKind } from './shack';
import { isleMaterial, setIslePack } from './isle';
import { dressingMaterial } from './dressing';

/**
 * SHARD-PLATFORM SF72: Sky Reach's world pieces drawn from their offline bake. The shapes are built at build time
 * (`generators/*.ts`, `scripts/bake-sky-world.mjs`) and folded into instanced kinds (`@wildshard/sdk/bake/kinds`); the
 * client loads each piece's GLB behind the loading screen and draws it in its own materials: a shack part in its kind's
 * material graph (`world/shack.ts`), a dressing kind in its own (`world/dressing.ts`), anything else in its row's standard material (a kind with a `paint` in the islands'
 * paint, `isleMaterial`). The colliders are the rows'.
 */

const SHACK: readonly ShackKind[] = ['plank', 'shingle', 'stone', 'beam'];
const shackKind = (kind: object): ShackKind | undefined => {
  const name: unknown = 'shack' in kind ? kind.shack : undefined;
  return SHACK.find((k) => k === name);
};

export const WORLD = bakedMeshWorld<BakedPiece, BakedMeshKindRow>(WORLD_BAKES, BAKED_URLS, 'far-reach', {
  resources: WORLD_BYTES, readBytes: fetchDeflated,
  material: (kind) => { const shack = shackKind(kind), dressed: unknown = 'dressing' in kind ? kind.dressing : undefined;
    return shack !== undefined ? shackMaterial(shack) : typeof dressed === 'string' ? dressingMaterial(dressed) : 'paint' in kind ? isleMaterial() : undefined; },
  attributes: { _shk: 'aShk', _farcloth: 'aFarCloth' },
});
/** Load every baked piece, the islands and the meadow's blades (the plugin's `world` hook, before the world is built); a piece that fails to load is empty. */
export async function loadSkyBaked(): Promise<void> {
  await WORLD.load(); setIslePack(WORLD.bytes('isles'));
}

/** The meadow's baked blades (generators/meadowBlades.ts → baked/meadow-blades.bin, inflated); undefined when they did not load. */
export const skyMeadowBlades = (): Uint8Array | undefined => WORLD.bytes('blades') ?? undefined;

/**
 * A world piece from its bake: its kinds as instanced meshes (undrawn if its GLB did not load; a tinted kind gets its rows'
 * per-instance colours) and its baked colliders. `nodes` defaults to the loaded bake (a test passes the GLB's nodes it parsed itself).
 */
export const skyBakedPiece = (piece: BakedPiece, nodes?: ReadonlyMap<string, Mesh>): DrawnBakedMeshPiece => WORLD.piece(piece, { nodes });

/** The knolls' hull colliders by knoll id (the rows' `hulls`: the SDK's baked collider rows are boxes), on the meadow. */
export function skyKnollHulls(): ReadonlyMap<string, ColliderDesc> {
  return new Map(SKY_KNOLL_HULLS.map((h) => [h.id, { kind: 'hull', x: h.x, y: h.y, z: h.z, points: new Float32Array(h.points), surface: 'grass' } satisfies ColliderDesc]));
}

/**
 * One of the baked shapes Sky Reach instances itself (`generators/geometries.ts`: the grass clump, the daisy, the boulder,
 * the code pine, the fir, the falls' sheet): a copy its caller owns, unindexed as built; empty when the bake did not load.
 */
export function skyBakedGeometry(kind: 'clump' | 'flower' | 'boulder' | 'pine' | 'fir' | 'fall'): BufferGeometry {
  const node = WORLD.last()?.get('geometries')?.get(kind); if (node === undefined) return new BufferGeometry();
  const g = node.geometry.clone(), index = g.getIndex();
  if (index !== null && Array.from(index.array).every((n, i) => n === i)) g.setIndex(null);
  return g;
}

/** Sky's world pieces (data/pieces.ts) placed under `root` and registered, the baked ones drawn from the loaded bake. */
export const skyPieces = (register: Parameters<typeof worldPieces>[0], root: Object3D): WorldPieces => worldPieces(register, root, SKY_PIECES, (piece) => skyBakedPiece(piece), [...BRIDGE_PHYSICS,...PLACEMENTS]);
