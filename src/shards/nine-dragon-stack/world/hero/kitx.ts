import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Merge the existing ruled and swept baked draws in their original order. No primitive authoring remains here. */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries([...parts], false);
  geometry.computeBoundingSphere();
  return geometry;
}
