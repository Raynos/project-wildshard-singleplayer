import { type BufferGeometry, Mesh, type Object3D } from 'three';
import { prepareRigLoader } from '@wildshard/engine/anim/rig';
import type { Scope } from '@wildshard/engine/app/scope';
import { wholeGeometryPieces, type WholeGeometryPiece } from '../plugin/geometry';
import type { ShardProduct } from './shardProduct';
import { runtimeProduct } from './runtimeProduct';

/** One verified declared fine tile, decoded as independent original draw pieces.
 * Its caller owns the returned geometries; parser staging and transport never
 * remain retained by a settled read. */
export async function readWholePieces(owner: Scope, product: ShardProduct, hash: string): Promise<readonly WholeGeometryPiece[]> {
  const live = (): void => { if (owner.disposed || owner.disposing) throw new Error('Whole piece owner is retired'); };
  live();
  const declared = product.shardfile.files.find(file => file.hash === hash);
  if (declared?.kind !== 'glb' || !product.shardfile.tiles.some(tile => tile.lod === 0 && tile.files.includes(hash))) throw new Error('Whole piece needs a declared fine tile');
  const admitted = runtimeProduct(product.shardfile);
  if (admitted === null) throw new Error('Whole piece needs an admitted product');
  const bytes = await admitted.assets.read(hash); live();
  const gltf = await (await prepareRigLoader()).createRigLoader().parseBytesAsync(bytes, '');
  const meshes: Mesh[] = [], cleanup = new Set<BufferGeometry>(), materials = new Set<ReturnType<typeof materialList>[number]>();
  let pieces: readonly WholeGeometryPiece[] = [];
  try {
    gltf.scene.traverse((node: Object3D) => { if (wholeMesh(node)) { meshes.push(node); cleanup.add(node.geometry); for (const material of materialList(node)) materials.add(material); } });
    live(); pieces = wholeGeometryPieces(meshes); live();
    await admitted.releaseTransport([hash]); live();
    return pieces;
  } catch (error) { for (const piece of pieces) piece.geometry.dispose(); throw error; }
  finally { for (const geometry of cleanup) geometry.dispose(); for (const material of materials) material.dispose(); admitted.assets.releaseTiles(); }
}
function materialList(mesh: Mesh) { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }

function wholeMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
