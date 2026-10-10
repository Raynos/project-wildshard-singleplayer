// uniformScan — find the program meshes under a root that carry a numeric uniform (SHARD-PLATFORM M3, ex Nine Dragon's
// look/render.ts): a look finds its own card sets by the uniform they declare, without a registry, and drives that
// uniform on all of them at once.
//
//   const { meshes, uniforms } = meshesWithUniform(scene, 'uCardOn');   for (const u of uniforms) u.value = 0.6;
import { type IUniform, Mesh, type Object3D, ShaderMaterial } from 'three';

/** Every mesh under `root` (in traversal order) whose ShaderMaterial has a numeric uniform `name`, and those uniforms. */
export function meshesWithUniform(root: Object3D, name: string): { meshes: Object3D[]; uniforms: IUniform<number>[] } {
  const uniforms: IUniform<number>[] = [];
  const meshes: Object3D[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !(o.material instanceof ShaderMaterial)) return;
    const u = o.material.uniforms[name];
    if (u !== undefined && typeof u.value === 'number') { uniforms.push(u as IUniform<number>); meshes.push(o); }
  });
  return { meshes, uniforms };
}
