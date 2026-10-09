import { Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Shardfile } from '../shardfile/schema';
import type { FarPrepared } from './farView';

function isMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }

/** Authored mesh worlds ship their one-draw proxy inside the admitted product, without a second baked-folder copy. */
export async function loadShardfileFar(source: Shardfile, read: (ref: string) => Promise<Uint8Array>): Promise<{ prepared: FarPrepared; bytes: number }> {
  const far = source.far, ref = source.props?.far;
  if (far === null || ref === null || ref === undefined || !far.files.includes(ref)) throw new Error('Authored world has no declared far GLB');
  const gltf = await new GLTFLoader().parseAsync((await read(ref)).slice().buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  gltf.scene.traverse(node => {
    if (!isMesh(node)) return;
    meshes.push(node);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
  });
  const mesh = meshes[0];
  if (meshes.length !== 1 || mesh === undefined) {
    for (const node of meshes) node.geometry.dispose();
    throw new Error('Authored far GLB must contain one mesh');
  }
  const geometry = mesh.geometry;
  geometry.applyMatrix4(mesh.matrixWorld);
  const fog = source.look.keys[0]?.fog;
  return { prepared: { geometry, positionalMask: true, look: { family: 'pbr', haze: {
    colour: fog?.colour ?? [1, 1, 1], near: fog?.near ?? 160, far: fog?.far ?? 700, max: 1,
  } } }, bytes: far.decoded + far.gpu };
}
