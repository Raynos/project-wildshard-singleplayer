/**
 * G144 (E435): Driftwood's built world, its vertex data on the GPU only once drawn. Every static attribute but `position`
 * (and every index) gives up its CPU copy the moment it uploads: the SF46 breakdown measured −82.4 MB of ArrayBuffers
 * (`docs/design/mmo/research/e435/memory-pine-driftwood.md`, experiment 1). Nothing changes on screen: the GPU copy is the
 * one drawn. Kept, for their CPU readers: `position` and the index (Explorer picking, the boat's mooring ropes, trimesh
 * colliders), every attribute that is not static-draw (ground-cover refills, gull wings, shrine fireflies), and any skinned
 * or morphing mesh. The bounds are computed first (culling reads them). Only Driftwood's own roots are walked, never the
 * scene: a grid neighbour or the platform road built meanwhile keeps its arrays.
 *
 * Call it at the end of the world build, before the first frame: a mesh already drawn keeps its copy (its upload hook
 * never fires), which only costs the saving, never a picture.
 */
import { Mesh, Object3D, SkinnedMesh, type BufferGeometry } from 'three';
import { gpuOnlyAttributes } from '@wildshard/engine/core/gpuOnly';
import type { DriftwoodWorld } from './build';

const HANDLES = ['group', 'mesh', 'ropes', 'fish'] as const;

function isObject3D(v: unknown): v is Object3D { return v instanceof Object3D; }
function isStaticMesh(o: Object3D): o is Mesh { return o instanceof Mesh && !(o instanceof SkinnedMesh); }

function rootsOf(value: unknown, out: Object3D[]): void {
  if (Array.isArray(value)) { for (const v of value) rootsOf(v, out); return; }
  if (value === null || typeof value !== 'object') return;
  if (isObject3D(value)) { out.push(value); return; }
  for (const key of HANDLES) { const v: unknown = Reflect.get(value, key); if (isObject3D(v)) out.push(v); }
  const placed: unknown = Reflect.get(value, 'placed');
  for (const p of Array.isArray(placed) ? placed : [placed]) {
    if (p !== null && typeof p === 'object') { const o: unknown = Reflect.get(p, 'object'); if (isObject3D(o)) out.push(o); }
  }
}

/** Driftwood's own drawn roots: each built thing's group / mesh / placed models (the island's tiles under its group). */
export function driftwoodRoots(world: DriftwoodWorld): Object3D[] {
  const out: Object3D[] = [];
  for (const v of Object.values(world)) rootsOf(v, out);
  return out;
}

function hasMorphs(g: BufferGeometry): boolean { return Object.keys(g.morphAttributes).length > 0; }

/** Mark every static geometry under Driftwood's roots GPU-only; returns the bytes that go once each uploads. */
export function releaseDriftwoodCopies(world: DriftwoodWorld): number {
  const seen = new Set<BufferGeometry>();
  let bytes = 0;
  for (const root of driftwoodRoots(world)) {
    root.traverse((o) => {
      if (!isStaticMesh(o)) return;
      const geometry = o.geometry;
      if (seen.has(geometry)) return;
      seen.add(geometry);
      if (!hasMorphs(geometry)) bytes += gpuOnlyAttributes(geometry, 'driftwood.world', ['position']);
    });
  }
  return bytes;
}
