import { Color, Float32BufferAttribute, BufferGeometry, Uint16BufferAttribute, Vector3, type BufferGeometry as Geo } from 'three';
import type { Home } from '../layout';
import type { Animal } from '#engine';

/**
 * A flat-shaded creature hull from primitive parts: each part is placed in bind space, painted one colour and skinned
 * rigidly to one bone (its index in `build().bones`).
 */
export function hull(parts: readonly { geometry: Geo; bone: number; color: number; at?: readonly [number, number, number]; rot?: readonly [number, number, number] }[]): BufferGeometry {
  const pos: number[] = [], col: number[] = [], bones: number[] = [], c = new Color(), v = new Vector3();
  for (const part of parts) {
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (part.rot) { g.rotateX(part.rot[0]); g.rotateY(part.rot[1]); g.rotateZ(part.rot[2]); }
    if (part.at) g.translate(part.at[0], part.at[1], part.at[2]);
    const p = g.getAttribute('position'); c.setHex(part.color);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); bones.push(part.bone); }
    if (g !== part.geometry) g.dispose(); part.geometry.dispose();
  }
  const g = new BufferGeometry(), count = pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { index[i * 4] = bones[i] ?? 0; weight[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  g.computeVertexNormals(); return g;
}

/** Where each spawned creature belongs (its island or its flying circle). The plugin sets it at spawn. */
const homes = new WeakMap<Animal, Home>();
export function setHome(a: Animal, home: Home): void { homes.set(a, home); }
export function homeOf(a: Animal, fallback: Home): Home { return homes.get(a) ?? fallback; }
/** Heading in the creature convention (0 faces +Z) from `a` toward a point. */
export const yawTo = (a: Animal, x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);
