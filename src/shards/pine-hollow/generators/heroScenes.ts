/** Hero rest transforms, LOD pivots, hull samples and arch cuts belong to the bake. */
import { BufferAttribute, BufferGeometry, Material, Mesh, PlaneGeometry, Vector3, type Object3D } from 'three';
import type { SourceModel } from '@wildshard/sdk/bake/skinned';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };

interface HeroMesh extends Object3D {
  readonly geometry: BufferGeometry;
  readonly material: Material | Material[];
}

function geometryMesh(value: unknown): value is HeroMesh {
  if (!(value instanceof Mesh)) return false;
  const geometry: unknown = value.geometry, material: unknown = value.material;
  return geometry instanceof BufferGeometry && (material instanceof Material
    || Array.isArray(material) && material.every((entry: unknown) => entry instanceof Material));
}

/** The first mesh's original Float32 channels, in the source file's own space. */
export function heroRestShape(source: SourceModel): BufferGeometry {
  source.gltf.scene.updateMatrixWorld(true);
  const node: unknown = source.gltf.scene.getObjectByProperty('isMesh', true);
  if (!geometryMesh(node)) throw new Error('Hero source requires its first mesh');
  const geometry = node.geometry.clone();
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    if (attribute.array instanceof Float32Array && !attribute.normalized && !('isInterleavedBufferAttribute' in attribute)) continue;
    const words = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) for (let k = 0; k < attribute.itemSize; k++) words[i * attribute.itemSize + k] = attribute.getComponent(i, k);
    geometry.setAttribute(name, new BufferAttribute(words, attribute.itemSize));
  }
  geometry.applyMatrix4(node.matrixWorld); geometry.computeBoundingBox();
  return geometry;
}

/** Preserve the native pair loader's base-centre alignment, including Float32 rounding. */
export function alignHeroLod(fine: BufferGeometry, coarse: BufferGeometry): void {
  const a = fine.boundingBox?.getCenter(new Vector3()), b = coarse.boundingBox?.getCenter(new Vector3());
  if (a === undefined || b === undefined) throw new Error('Hero LOD bounds are missing');
  coarse.translate(a.x - b.x, 0, a.z - b.z);
  coarse.boundingBox?.translate(new Vector3(a.x - b.x, 0, a.z - b.z));
}

/** Same <=180-point stride as the retained native body; do not refit or simplify. */
export function heroHullPoints(geometry: BufferGeometry): number[] {
  const position = geometry.getAttribute('position'), step = Math.max(1, Math.floor(position.count / 180));
  const points = new Float32Array(Math.ceil(position.count / step) * 3);
  let k = 0;
  for (let i = 0; i < position.count; i += step) { points[k++] = position.getX(i); points[k++] = position.getY(i); points[k++] = position.getZ(i); }
  return [...points.subarray(0, k)];
}

/** Material preparation retains the source's maps; geometry is always an admitted identity-space draw. */
export function disposeHeroSource(source: SourceModel): void {
  const visit = (node: Object3D): void => {
    if (!geometryMesh(node)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
  };
  source.gltf.scene.traverse(visit);
}

/** The shipped exclusion mask becomes final index bytes, for both admitted LODs. */
export function openedArch(geometry: BufferGeometry, level: 'fine' | 'coarse'): BufferGeometry {
  const row = authored.landmarks.archShape[level], result = geometry.clone(), position = result.getAttribute('position'), index = result.getIndex();
  const triangles = (index?.count ?? position.count) / 3, keep: number[] = [];
  if (position.count !== row.vertices || triangles !== row.triangles || triangles > 65_536
    || row.excluded.length !== Math.ceil(triangles / 4) || !/^[0-9a-f]+$/u.test(row.excluded)) throw new Error('Arch passage facts differ from source geometry');
  for (let t = 0; t < triangles; t++) if ((Number.parseInt(row.excluded[Math.floor(t / 4)] ?? '', 16) & (1 << (t % 4))) === 0)
    for (const corner of [0, 1, 2]) keep.push(index === null ? t * 3 + corner : index.getX(t * 3 + corner));
  result.setIndex(keep);
  return result;
}

/** Original coarse-bounds plane for the closed variant, baked with its translation. */
export function closedArchPlane(): BufferGeometry {
  const { w, h, x, y, z } = authored.landmarks.archShape.coarse.dark;
  return new PlaneGeometry(w, h).translate(x, y, z);
}
