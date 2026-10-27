import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, type Matrix4 } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

await MeshoptSimplifier.ready;

/**
 * Tile streaming U2 / G748: a coarse (L1) copy of whole shapes in their own look, for a props bake's `coarse` source.
 * Each shape's geometry is simplified once in its own frame (meshopt, borders locked, `errorMetres` absolute; the kept
 * vertices keep every channel, so the shape keeps its vertex colours) and placed at its transform, on one rough
 * vertex-coloured surface (the props bake's static merge draws it in its own merged look). The ratio is a target: error
 * and border locks may keep more triangles. The caller calls `dispose` after the bake.
 */
export function coarseCopy(shapes: readonly { readonly mesh: Mesh; readonly transform: Matrix4 }[], ratio = 0.25, errorMetres = 1): { readonly group: Group; readonly dispose: () => void } {
  if (!(ratio > 0 && ratio <= 1) || !(errorMetres > 0)) throw new Error('Coarse copy needs a ratio in (0, 1] and a positive error');
  const group = new Group(), material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), geometries: BufferGeometry[] = [];
  for (const { mesh, transform } of shapes) {
    const source = mesh.geometry, position = source.getAttribute('position');
    if (!(position instanceof BufferAttribute) || position.itemSize !== 3) throw new Error('Coarse copy needs plain positions');
    const index = source.getIndex(), triangles = index === null ? Array.from({ length: position.count }, (_, i) => i) : Array.from(index.array);
    const positions = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    const target = Math.max(3, Math.floor(triangles.length / 3 * ratio) * 3);
    const [kept] = MeshoptSimplifier.simplify(Uint32Array.from(triangles), positions, 3, target, errorMetres, ['LockBorder', 'ErrorAbsolute']);
    const geometry = new BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute.clone());
    geometry.setIndex(Array.from(kept));
    geometries.push(geometry);
    const copy = new Mesh(geometry, material);
    transform.decompose(copy.position, copy.quaternion, copy.scale);
    group.add(copy);
  }
  return { group, dispose: () => { for (const geometry of geometries) geometry.dispose(); material.dispose(); } };
}
