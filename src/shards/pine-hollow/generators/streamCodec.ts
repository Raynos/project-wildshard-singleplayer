/** Independent retained raw-water oracle; the live page reads only admitted original GLB draws. */
import * as THREE from 'three';

/** The native stream's complete packed geometry contract. */
export interface StreamShapeRows { bytes: number; vertices: number; indices: number; wide: boolean }

/** Restore the original channels, triangle width and smoothed normals without resampling. */
export function streamGeometry(bytes: Uint8Array, rows: StreamShapeRows): THREE.BufferGeometry {
  if (bytes.length !== rows.bytes) throw new Error(`[streams] the bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
  const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes);
  const n = rows.vertices, pad4 = (b: number): number => Math.ceil(b / 4) * 4;
  let at = 0;
  const floats = (count: number): Float32Array => { const a = new Float32Array(buffer, at, count); at += pad4(count * 4); return a; };
  const pos = floats(n * 3), uv = floats(n * 2), aw = floats(n * 4);
  const index = rows.wide ? new Uint32Array(buffer, at, rows.indices) : new Uint16Array(buffer, at, rows.indices);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
