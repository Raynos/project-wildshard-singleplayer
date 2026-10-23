import { InstancedMesh, Mesh, Object3D, SkinnedMesh, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static sibling meshes as one draw (G639 frame floor; Developer row `staticSets`, default off).
 *
 * A placed static piece (a camp, a run of fences, a set of crags) is often built as several sibling meshes that share one
 * material: each costs a draw (~100 µs of script a draw at phone 4x) for no difference on screen. `mergeStaticSiblings`
 * merges a root's direct children that are plain meshes with the same material instance and the same draw state into one
 * mesh per group, their geometry baked in the root's frame. Instanced, skinned, morphing, grouped, hidden or hooked meshes,
 * and meshes with children, are left as they are. The source geometries are not disposed (a catalogue may share them);
 * the caller owns the merged ones it gets back.
 */
const defaultBeforeRender = Object3D.prototype.onBeforeRender;
function mergeable(node: Object3D): node is Mesh<BufferGeometry, Material> {
  if (!(node instanceof Mesh) || node instanceof InstancedMesh || node instanceof SkinnedMesh) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return node.visible && node.children.length === 0 && node.onBeforeRender === defaultBeforeRender && !Array.isArray(material)
    && typeof geometry === 'object' && geometry !== null && node.geometry.groups.length === 0 && Object.keys(node.geometry.morphAttributes).length === 0;
}
function signature(node: Mesh<BufferGeometry, Material>): string {
  const geometry = node.geometry, attributes = Object.keys(geometry.attributes).sort().map((name) => {
    const a = geometry.getAttribute(name);
    return `${name}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`;
  });
  return [node.material.uuid, node.castShadow, node.receiveShadow, node.renderOrder, node.frustumCulled, node.layers.mask, geometry.index === null ? 'flat' : 'indexed', ...attributes].join('|');
}

/** Merge `root`'s mergeable sibling meshes, per material and draw state, into one mesh each; returns the merged geometries
 *  (for the caller to own) and how many draws that removed. */
export function mergeStaticSiblings(root: Object3D): { readonly geometries: readonly BufferGeometry[]; readonly saved: number } {
  const groups = new Map<string, Mesh<BufferGeometry, Material>[]>();
  for (const child of root.children) if (mergeable(child)) {
    const key = signature(child), list = groups.get(key);
    if (list === undefined) groups.set(key, [child]); else list.push(child);
  }
  const geometries: BufferGeometry[] = [];
  let saved = 0;
  for (const members of groups.values()) {
    const first = members[0];
    if (members.length < 2 || first === undefined) continue;
    const parts = members.map((member) => { member.updateMatrix(); return member.geometry.clone().applyMatrix4(member.matrix); });
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (merged === null) continue;
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const mesh = new Mesh(merged, first.material);
    mesh.name = `${first.name || 'mesh'}+${String(members.length - 1)}`;
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
    mesh.frustumCulled = first.frustumCulled; mesh.layers.mask = first.layers.mask;
    for (const member of members) root.remove(member);
    root.add(mesh);
    geometries.push(merged); saved += members.length - 1;
  }
  return { geometries, saved };
}
