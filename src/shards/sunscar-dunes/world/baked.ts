import { loadRigFile } from '@wildshard/engine/anim/rig';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { Group, InstancedMesh, MeshStandardMaterial, type Object3D } from 'three';
import rocks from '../data/rocks.json' with { type: 'json' };
import { BAKED_ROCKS_URL } from '../boot/files';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' world pieces drawn from their offline bake.
 * The shapes are built at build time (`generators/rocks.ts`, `scripts/bake-signal-world.mjs`); the client reads the static
 * GLB (one instanced node per kind, one draw each; `data/rocks.json` holds its content hash) and the collider rows, and only puts its own
 * materials on them. The colliders never wait on the GLB: a GLB that fails to load leaves the rocks undrawn but solid.
 */
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

/** A loaded bake: each kind's instanced mesh (its geometry and transforms), keyed by the kind's name. */
export type BakedWorld = ReadonlyMap<string, InstancedMesh>;

/** Load the baked GLB behind the loading screen (the plugin's `world` hook); an empty bake when it fails to load. */
export async function loadBakedWorld(): Promise<BakedWorld> {
  const meshes = new Map<string, InstancedMesh>();
  try {
    const gltf = await loadRigFile(BAKED_ROCKS_URL), nodes: InstancedMesh[] = [];
    gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
    if (nodes.length !== rocks.kinds.length) throw new Error(`rocks: ${String(nodes.length)} baked nodes, ${String(rocks.kinds.length)} declared`);
    rocks.kinds.forEach((kind, i) => { const node = nodes[i]; if (node !== undefined) meshes.set(kind.name, node); });
  } catch (e: unknown) { console.warn('[sunscar-dunes] the baked rocks did not load; they stand undrawn:', e); }
  return meshes;
}

const box = (c: (typeof rocks.colliders)[number]): ColliderDesc => {
  if (c.kind !== 'box' || c.surface !== 'rock') throw new Error('rocks: a baked collider is a rock box');
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, yaw: c.yaw, surface: 'rock' };
};

/** The wind-cut rock field from its bake: each kind one `InstancedMesh` in its sandstone, and the baked box colliders. */
export function bakedRocks(baked: BakedWorld): { root: Group; colliders: ColliderDesc[] } {
  const root = new Group();
  for (const kind of rocks.kinds) {
    const node = baked.get(kind.name); if (node === undefined) continue;
    const mesh = new InstancedMesh(node.geometry, new MeshStandardMaterial({ color: kind.color, roughness: kind.roughness, flatShading: true }), kind.count);
    mesh.instanceMatrix.array.set(node.instanceMatrix.array.subarray(0, kind.count * 16)); mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.castShadow = false; root.add(mesh);
  }
  return { root, colliders: rocks.colliders.map(box) };
}
