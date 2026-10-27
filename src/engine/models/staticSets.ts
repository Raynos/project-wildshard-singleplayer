import { BufferGeometry, InstancedMesh, Mesh, Object3D, SkinnedMesh, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorkSlice } from '../core/workSlice';
import { geometryBoundsSteps } from '../world/geometryBounds';

/**
 * Static sibling meshes as one draw (G639 frame floor; scene dressing always merges, DR7 / G669).
 *
 * A placed static piece (a camp, a run of fences, a set of crags) is often built as several sibling meshes that share one
 * material: each costs a draw (~100 µs of script a draw at phone 4x) for no difference on screen. `mergeStaticSiblingsSliced`
 * merges a root's direct children that are plain meshes with the same material instance and the same draw state into one
 * mesh per group, their geometry baked in the root's frame. Instanced, skinned, morphing, grouped, hidden or hooked meshes,
 * and meshes with children, are left as they are. The source geometries are not disposed (a catalogue may share them);
 * the caller owns the merged ones it gets back.
 */
const defaultBeforeRender: unknown = Reflect.get(Object3D.prototype, 'onBeforeRender');
const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
function mergeable(node: Object3D): node is Mesh<BufferGeometry, Material> {
  if (!(node instanceof Mesh) || node instanceof InstancedMesh || node instanceof SkinnedMesh) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material, hook: unknown = Reflect.get(node, 'onBeforeRender');
  return node.visible && node.children.length === 0 && hook === defaultBeforeRender && !Array.isArray(material)
    && isGeometry(geometry) && geometry.groups.length === 0 && Object.keys(geometry.morphAttributes).length === 0;
}
function signature(node: Mesh<BufferGeometry, Material>): string {
  const geometry = node.geometry, attributes = Object.keys(geometry.attributes).sort().map((name) => {
    const a = geometry.getAttribute(name);
    return `${name}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`;
  });
  return [node.material.uuid, node.castShadow, node.receiveShadow, node.renderOrder, node.frustumCulled, node.layers.mask, geometry.index === null ? 'flat' : 'indexed', ...attributes].join('|');
}

/** Merge `root`'s mergeable sibling meshes, per material and draw state, into one mesh each, under `slice`: it yields after
 *  each member's transformed copy, each bounds chunk and each merged group (one task was ~84 ms of Nalati's dressing in a cold crossing's
 *  world step at phone 4× CPU). Returns the merged geometries (for the caller to own) and how many draws that removed. */
export async function mergeStaticSiblingsSliced(root: Object3D, slice: WorkSlice): Promise<{ readonly geometries: readonly BufferGeometry[]; readonly saved: number }> {
  const steps = mergeSteps(root);
  try {
    for (;;) {
      const step = steps.next();
      if (step.done) { if (step.value === undefined) throw new Error('Static sibling merge did not finish'); return step.value; }
      const pause = slice.check(); if (pause !== undefined) await pause;
    }
  } finally { steps.return(undefined); }
}

function* mergeSteps(root: Object3D): Generator<void, { readonly geometries: readonly BufferGeometry[]; readonly saved: number } | undefined> {
  const groups = new Map<string, Mesh<BufferGeometry, Material>[]>();
  for (const child of root.children) if (mergeable(child)) {
    const key = signature(child), list = groups.get(key);
    if (list === undefined) groups.set(key, [child]); else list.push(child);
  }
  const geometries: BufferGeometry[] = [], made: Mesh[] = [], temporary = new Set<BufferGeometry>();
  let saved = 0, completed = false;
  try {
    for (const members of groups.values()) {
      const first = members[0];
      if (members.length < 2 || first === undefined) continue;
      const parts: BufferGeometry[] = [];
      for (const member of members) {
        member.updateMatrix(); const copy = member.geometry.clone(); temporary.add(copy);
        // These copies are private merge inputs, never drawn. Transform only
        // their attributes; the merged result gets exact bounds below. Keeping
        // cloned bounds here rescans every member before scanning the union.
        copy.boundingBox = null; copy.boundingSphere = null;
        copy.applyMatrix4(member.matrix); parts.push(copy); yield;
      }
      // typed non-null, but null on a layout mismatch
      const merged: unknown = mergeGeometries(parts, false);
      for (const part of parts) { part.dispose(); temporary.delete(part); }
      if (!isGeometry(merged)) continue;
      temporary.add(merged);
      yield* geometryBoundsSteps(merged); // one exact box scan plus the radius, in bounded CPU chunks
      const mesh = new Mesh(merged, first.material);
      mesh.name = `${first.name || 'mesh'}+${String(members.length - 1)}`;
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
      mesh.frustumCulled = first.frustumCulled; mesh.layers.mask = first.layers.mask;
      for (const member of members) root.remove(member);
      root.add(mesh); made.push(mesh);
      geometries.push(merged); temporary.delete(merged); saved += members.length - 1;
      yield;
    }
    completed = true; return { geometries, saved };
  } finally {
    for (const geometry of temporary) geometry.dispose();
    if (!completed) { for (const mesh of made) mesh.removeFromParent(); for (const geometry of geometries) geometry.dispose(); }
  }
}
