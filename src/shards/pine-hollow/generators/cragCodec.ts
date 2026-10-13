/** Original raw skin oracle; runtime consumes the charged Scene instead of this byte layout. */
import * as THREE from 'three';
import type { CragRows, CragTier } from './cragRows';

type SkinRows = CragRows['skin'][CragTier];
const pad4 = (bytes: number): number => Math.ceil(bytes / 4) * 4;

/** Original aligned position, AO and triangle block size. */
export function skinBytes(vertices: number, indices: number): number { return pad4(vertices * 12) + pad4(vertices * 4) + pad4(indices * 2); }

/** The original native attributes, normals and bounds, without resampling or index conversion. */
export function skinGeometry(pos: Float32Array, ao: Float32Array, index: Uint16Array): THREE.BufferGeometry {
  const k = ao.length;
  const cd = new Float32Array(k * 4), ct = new Float32Array(k * 2);
  for (let i = 0; i < k; i++) { cd[i * 4] = ao[i] ?? 0; cd[i * 4 + 1] = 1; cd[i * 4 + 3] = 1; ct[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cdata', new THREE.BufferAttribute(cd, 4));
  g.setAttribute('ctint', new THREE.BufferAttribute(ct, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Decode the original byte oracle independently of the GLB reader. */
export class CragSkin {
  private readonly buffer: ArrayBuffer;
  private readonly rows: SkinRows;
  constructor(bytes: Uint8Array, rows: SkinRows) {
    this.rows = rows;
    if (bytes.length !== rows.bytes) throw new Error(`[crags] the skin bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
    if (rows.tiles.reduce((sum, [v0, i0, v1, i1]) => sum + skinBytes(v0, i0) + skinBytes(v1, i1), 0) !== bytes.length) throw new Error('[crags] the skin bake does not match its rows');
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
  }
  /** Near and far geometry in the original byte and tile order. */
  async tiles(yieldTask: () => Promise<void>): Promise<[THREE.BufferGeometry, THREE.BufferGeometry][]> {
    const out: [THREE.BufferGeometry, THREE.BufferGeometry][] = [];
    let offset = 0;
    const read = (vertices: number, indices: number): THREE.BufferGeometry => {
      const pos = new Float32Array(this.buffer, offset, vertices * 3); offset += pad4(vertices * 12);
      const ao = new Float32Array(this.buffer, offset, vertices); offset += pad4(vertices * 4);
      const index = new Uint16Array(this.buffer, offset, indices); offset += pad4(indices * 2);
      return skinGeometry(pos.slice(), ao.slice(), index.slice());
    };
    for (const [v0, i0, v1, i1] of this.rows.tiles) {
      out.push([read(v0, i0), read(v1, i1)]); await yieldTask();
    }
    return out;
  }
}
