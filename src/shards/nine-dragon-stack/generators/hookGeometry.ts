import { type BufferGeometry, Float32BufferAttribute, Mesh, type Object3D } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';

/** Preserve the native sculpt's widening and node-transform order before writing its exact typed channels. */
export async function hookGeometry(read: (url: string) => Uint8Array): Promise<BufferGeometry> {
  const { gltf } = await readSourceModel(read('/assets/nine-dragon/lab/grapple/dragon-hook.glb'));
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;
  gltf.scene.traverse(object => { if (isMesh(object)) meshes.push(object); });
  const source = meshes[0];
  if (source === undefined) throw new Error('Nine hook author has no mesh');
  const hook = source.geometry.clone();
  for (const name of ['position', 'normal', 'tangent']) {
    if (!hook.hasAttribute(name)) continue;
    const a = hook.getAttribute(name);
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    hook.setAttribute(name, new Float32BufferAttribute(out, a.itemSize));
  }
  hook.applyMatrix4(source.matrixWorld);
  return hook;
}
