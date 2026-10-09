import { loadRigFile } from '@wildshard/engine/anim/rig';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { DoubleSide, FrontSide, Group, InstancedMesh, MeshStandardMaterial, type Object3D } from 'three';
import rocks from '../data/rocks.json' with { type: 'json' };
import dressing from '../data/dressing.json' with { type: 'json' };
import tower from '../data/tower.json' with { type: 'json' };
import { BAKED_PIECES, bakedUrl, type BakedPiece } from '../boot/files';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' world pieces drawn from their offline bake.
 * The shapes are built at build time (`generators/*.ts`, `scripts/bake-signal-world.mjs`); the client reads each piece's
 * static GLB (one instanced node per kind, one draw each; `data/<piece>.json` holds its content hash) and the collider
 * rows, and only puts its own materials on them. The colliders never wait on the GLB: a GLB that fails to load leaves the
 * piece undrawn but solid.
 */
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

interface KindRow {
  name: string; count: number; color: number; roughness: number; metalness: number; flat: boolean; emissive: number; emissiveIntensity: number;
  vertexColors: boolean; doubleSided: boolean;
}
interface ColliderRow { kind: string; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw?: number; surface: string }
interface PieceRows { kinds: readonly KindRow[]; colliders: readonly ColliderRow[] }
const PIECES: Readonly<Record<BakedPiece, PieceRows>> = { rocks, dressing, tower };

/** A loaded bake: each piece's instanced meshes (their geometry and transforms), keyed by the kind's name. */
export type BakedWorld = ReadonlyMap<BakedPiece, ReadonlyMap<string, InstancedMesh>>;

async function loadPiece(piece: BakedPiece): Promise<ReadonlyMap<string, InstancedMesh>> {
  const meshes = new Map<string, InstancedMesh>(), rows = PIECES[piece];
  try {
    const gltf = await loadRigFile(bakedUrl(piece)), nodes: InstancedMesh[] = [];
    gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
    if (nodes.length !== rows.kinds.length) throw new Error(`${piece}: ${String(nodes.length)} baked nodes, ${String(rows.kinds.length)} declared`);
    rows.kinds.forEach((kind, i) => { const node = nodes[i]; if (node !== undefined) meshes.set(kind.name, node); });
  } catch (e: unknown) { console.warn(`[sunscar-dunes] the baked ${piece} did not load; it stands undrawn:`, e); }
  return meshes;
}

let last: BakedWorld | null = null;
/** Load every baked piece behind the loading screen (the plugin's `world` hook); a piece that fails to load is empty. */
export async function loadBakedWorld(): Promise<BakedWorld> {
  const names = BAKED_PIECES, loaded = await Promise.all(names.map(loadPiece));
  last = new Map(names.map((name, i) => [name, loaded[i] ?? new Map<string, InstancedMesh>()]));
  return last;
}
/** The bake loaded last (the Model Explorer's specimens draw from it), or null before the first load. */
export const lastBakedWorld = (): BakedWorld | null => last;

const SURFACES: readonly Material[] = ['rock', 'wood', 'metal'];
const surface = (s: string): Material => {
  const found = SURFACES.find((m) => m === s); if (found === undefined) throw new Error(`baked collider: unknown surface ${s}`);
  return found;
};
const box = (c: ColliderRow): ColliderDesc => {
  if (c.kind !== 'box') throw new Error('baked collider: a box');
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), surface: surface(c.surface) };
};

/** A world piece from its bake: each kind one `InstancedMesh` in its own material, and the baked colliders. */
export function bakedPiece(baked: BakedWorld, piece: BakedPiece): { root: Group; colliders: ColliderDesc[] } {
  const root = new Group(), rows = PIECES[piece], nodes = baked.get(piece);
  for (const kind of rows.kinds) {
    const node = nodes?.get(kind.name); if (node === undefined) continue;
    const material = new MeshStandardMaterial({ roughness: kind.roughness, metalness: kind.metalness, flatShading: kind.flat, emissive: kind.emissive, emissiveIntensity: kind.emissiveIntensity,
      side: kind.doubleSided ? DoubleSide : FrontSide, vertexColors: kind.vertexColors });
    if (!kind.vertexColors) material.color.setHex(kind.color);
    // a triangle soup (the dressing) bakes with the identity index glTF requires: it draws unindexed, as built
    const index = node.geometry.getIndex();
    if (index !== null && Array.from(index.array).every((n, i) => n === i)) node.geometry.setIndex(null);
    const mesh = new InstancedMesh(node.geometry, material, kind.count);
    mesh.instanceMatrix.array.set(node.instanceMatrix.array.subarray(0, kind.count * 16)); mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false; root.add(mesh);
  }
  return { root, colliders: rows.colliders.map(box) };
}
