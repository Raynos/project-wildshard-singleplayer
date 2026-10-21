import * as THREE from 'three';
import * as v from 'valibot';
import { VertexWearSchema } from '@wildshard/format/vertexWear';
import type { ShardProduct } from '../shardfile/shardProduct';

/** A declared vertex wear file, read: its texture (when it carries one), the rect that samples it, and `wear`, which
 *  hands a built geometry its part's attributes (views over the file's bytes, no copy). */
export interface VertexWear {
  readonly texture: THREE.DataTexture | null;
  readonly rect: readonly [number, number, number, number];
  wear: (geometry: THREE.BufferGeometry, part: number) => void;
}

/** G571: read a vertex wear row's file through the product's verified reader (`format/vertexWear` VertexWearSchema). A
 *  part whose vertex count differs from its geometry refuses: the file was baked for other geometry. Client-only. */
export async function loadVertexWear(product: Pick<ShardProduct, 'file'>, input: unknown): Promise<VertexWear> {
  const row = v.parse(VertexWearSchema, input), bytes = Uint8Array.from(await product.file(row.file)).buffer;
  let texture: THREE.DataTexture | null = null;
  if (row.texture !== null) {
    const { width, height } = row.texture;
    texture = new THREE.DataTexture(new Uint16Array(bytes, 0, width * height * 4), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  }
  return { texture, rect: row.rect, wear: (geometry, part) => {
    const [at, count] = row.parts[part] ?? [0, -1];
    if (geometry.getAttribute('position').count !== count) throw new Error('Vertex wear does not match its geometry; rebuild its declared file');
    let offset = at;
    for (const attribute of row.attributes) {
      geometry.setAttribute(attribute.name, new THREE.BufferAttribute(new Uint8Array(bytes, offset, count * attribute.size), attribute.size, true));
      offset += count * attribute.size;
    }
  } };
}
