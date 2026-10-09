import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakedColliders, bakedKindsGroup, loadBakedKinds } from '@wildshard/game/shardfile/bakedKinds';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, type Group } from 'three';
import winchHouse from '../data/winchHouse.json' with { type: 'json' };
import roost from '../data/roost.json' with { type: 'json' };
import docks from '../data/docks.json' with { type: 'json' };
import crown from '../data/crown.json' with { type: 'json' };
import mill from '../data/mill.json' with { type: 'json' };
import bookStand from '../data/bookStand.json' with { type: 'json' };
import knolls from '../data/knolls.json' with { type: 'json' };
import geometries from '../data/geometries.json' with { type: 'json' };
import { BAKED_PIECES, bakedUrl, type BakedPiece } from '../boot/files';
import { shackMaterial, type ShackKind } from './shack';
import { paintIsleMaterial } from './isle';

/**
 * SHARD-PLATFORM SF72: Sky Reach's world pieces drawn from their offline bake. The shapes are built at build time
 * (`generators/*.ts`, `scripts/bake-sky-world.mjs`) and folded into instanced kinds (`@wildshard/sdk/bake/kinds`); the
 * client loads each piece's GLB behind the loading screen and draws it in its own materials: a shack part in its kind's
 * procedural shader (`world/shack.ts`), anything else in its row's standard material (a kind with a `paint` in the islands'
 * painted rock, `paintIsleMaterial`). The colliders are the rows'.
 */
const PIECES = { 'winch-house': winchHouse, roost, docks, crown, mill, 'book-stand': bookStand, knolls, geometries } as const satisfies Readonly<Record<BakedPiece, unknown>>;

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
export function skyBakedPiece(piece: BakedPiece, nodes: ReadonlyMap<string, InstancedMesh> | undefined = loaded.get(piece)): { root: Group; colliders: ColliderDesc[]; kinds: ReadonlyMap<string, InstancedMesh> } {
  const rows = PIECES[piece];
  const root = bakedKindsGroup(nodes, rows.kinds, {
    material: (kind) => { const shack = shackKind(kind); return shack === undefined ? undefined : shackMaterial(shack); },
    decorate: (material, kind) => { const rockMix: unknown = 'paint' in kind ? kind.paint : undefined; if (typeof rockMix === 'number') paintIsleMaterial(material, rockMix); },
    attributes: { _shk: 'shk', _farcloth: 'farCloth' },
  });
  // the drawn kinds by name, in row order (a kind whose GLB did not load is absent)
  const drawn = rows.kinds.filter((kind) => nodes?.has(kind.name) === true);
  const kinds = new Map(drawn.flatMap((kind, i) => { const mesh = root.children[i]; return mesh instanceof InstancedMesh ? [[kind.name, mesh] as const] : []; }));
  // a tinted kind's per-instance colours (the rows' `tints`: the GLB carries none), on the drawn kinds in row order
  const tints: Readonly<Record<string, readonly number[]>> | undefined = 'tints' in rows ? rows.tints : undefined;
  drawn.forEach((kind, i) => {
    const mesh = root.children[i], tint = tints?.[kind.name];
    if (tint !== undefined && mesh instanceof InstancedMesh) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(tint), 3);
  });
  return { root, colliders: bakedColliders(rows.colliders), kinds };
}

/** The knolls' hull colliders by knoll id (the rows' `hulls`: the SDK's baked collider rows are boxes), on the meadow. */
export function skyKnollHulls(): ReadonlyMap<string, ColliderDesc> {
  return new Map(knolls.hulls.map((h) => [h.id, { kind: 'hull', x: h.x, y: h.y, z: h.z, points: new Float32Array(h.points), surface: 'grass' } satisfies ColliderDesc]));
}

/**
 * One of the baked shapes Sky Reach instances itself (`generators/geometries.ts`: the grass clump, the daisy, the boulder,
 * the code pine, the fir): a copy its caller owns, unindexed as built; empty when the bake did not load.
 */
export function skyBakedGeometry(kind: 'clump' | 'flower' | 'boulder' | 'pine' | 'fir'): BufferGeometry {
  const node = loaded.get('geometries')?.get(kind); if (node === undefined) return new BufferGeometry();
  const g = node.geometry.clone(), index = g.getIndex();
  if (index !== null && Array.from(index.array).every((n, i) => n === i)) g.setIndex(null);
  return g;
}
