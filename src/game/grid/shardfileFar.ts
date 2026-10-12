import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { nearPlaceholderCost } from '@wildshard/format/nearPlaceholder';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { FarPrepared } from './farView';

function isMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
/** three's merge returns null for parts whose attributes differ (its typing omits it). */
const merge: (parts: BufferGeometry[]) => BufferGeometry | null = mergeGeometries;

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
  return { prepared: { geometry, positionalMask: true, look: shardfileHaze(source) }, bytes: far.decoded + far.gpu };
}

/** A shardfile's own placeholder look: pbr in the haze of its first fog key (what `wildshard build` bakes it in). */
function shardfileHaze(source: Shardfile): FarPrepared['look'] {
  const fog = source.look.keys[0]?.fog;
  return { family: 'pbr', haze: { colour: fog?.colour ?? [1, 1, 1], near: fog?.near ?? 160, far: fog?.far ?? 700, max: 1 } };
}

/**
 * G348: any shardfile's own near placeholder (its admitted `near` row, which `wildshard build` bakes for every terrain
 * shardfile, an unknown uploaded one included): its content GLBs' meshes merged into the near view's one draw, masked by
 * position (an authored GLB's UVs carry no region contract), charged its admitted content residency. A row with content
 * owns its cell (it carries the shard's coarse world); a terrain-only row (L1 height tiles) is not drawn yet and rejects,
 * so the far proxy stays. Rejects when the shardfile declares no near row.
 */
export async function loadShardfileNear(source: Shardfile, read: (ref: string) => Promise<Uint8Array>): Promise<{ prepared: FarPrepared; bytes: number; owns: boolean }> {
  const near = source.near;
  if (near === undefined || near.content.length === 0) throw new Error('Shardfile declares no near content');
  const cost = nearPlaceholderCost(near, source), loader = new GLTFLoader(), parts: BufferGeometry[] = [];
  try {
    for (const ref of near.content) {
      const gltf = await loader.parseAsync((await read(ref)).slice().buffer, '');
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(node => {
        if (!isMesh(node)) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
        parts.push(node.geometry.applyMatrix4(node.matrixWorld));
      });
    }
  } catch (error) { for (const part of parts) part.dispose(); throw error; }
  const [first] = parts;
  if (first === undefined) throw new Error('Near content has no mesh');
  const geometry = parts.length === 1 ? first : merge(parts);
  if (parts.length > 1) for (const part of parts) part.dispose();
  if (geometry === null) throw new Error('Near content has no mergeable mesh');
  return { prepared: { geometry, positionalMask: true, look: shardfileHaze(source) }, bytes: cost.content.resident, owns: true };
}
