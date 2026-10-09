import { DoubleSide, Matrix4, MeshStandardMaterial, type InstancedMesh } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';

/**
 * Build-time only (SHARD-PLATFORM SF72): one baked world piece of Signal Dunes, from the runtime builder's own instanced
 * kinds. Each non-empty kind is one GLB node (its geometry and EXT_mesh_gpu_instancing transforms, one draw each, never
 * multi-draw); its row says how the client draws it (`world/baked.ts`). The colliders are the builder's own, as JSON keeps
 * them (a `-0` yaw is `0`, as the rows' JSON holds it).
 */

/** One baked instanced kind: the GLB node's name, its instance count and the material the client draws it in. */
export interface BakedKind {
  name: string; count: number; color: number; roughness: number; metalness: number; flat: boolean; emissive: number; emissiveIntensity: number;
  vertexColors: boolean; doubleSided: boolean;
}
/** A piece's bake: the GLB bytes and its rows (`data/<piece>.json`, with the GLB's content hash). */
export interface PieceBake { glb: Uint8Array; kinds: BakedKind[]; colliders: ColliderDesc[] }

export function bakeKinds(piece: string, meshes: readonly (readonly [string, InstancedMesh])[], colliders: readonly ColliderDesc[]): PieceBake {
  const kinds: BakedKind[] = [], primitives: GlbPrimitive[] = [];
  for (const [name, mesh] of meshes) {
    if (mesh.count === 0) continue;
    // the GLB carries no per-instance colour: a tinted kind (the shrubs, the tufts) needs it baked before it has instances
    if (mesh.instanceColor !== null) throw new Error(`${piece}.${name}: per-instance colours are not baked`);
    const instances = Array.from({ length: mesh.count }, (_, i) => { const m = new Matrix4(); mesh.getMatrixAt(i, m); return m; });
    const material = Array.isArray(mesh.material) ? undefined : mesh.material;
    if (!(material instanceof MeshStandardMaterial)) throw new Error(`${piece}.${name}: one standard material per kind`);
    primitives.push({ geometry: mesh.geometry, material, instances, castShadow: false });
    kinds.push({ name, count: mesh.count, color: material.color.getHex(), roughness: material.roughness, metalness: material.metalness, flat: material.flatShading,
      emissive: material.emissive.getHex(), emissiveIntensity: material.emissiveIntensity, vertexColors: material.vertexColors, doubleSided: material.side === DoubleSide });
  }
  const rows: ColliderDesc[] = colliders.map((c) => 'yaw' in c && c.yaw === 0 ? { ...c, yaw: 0 } : c);
  return { glb: staticGlb(primitives, `sunscar.${piece}`), kinds, colliders: rows };
}
