import { Quaternion, Vector3 } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

export interface PalmParams { readonly h: number; readonly lean: number; readonly leanDir: number; readonly rot: number; readonly fronds: number }
export interface HibiscusBushParams { readonly r: number; readonly flowers: boolean; readonly phase: number }
export const palm = { id: 'driftwood-isle/palm', seed: 0x5ea1 ^ 0x9a,
  defaults: { h: 8, lean: 0.2, leanDir: 0, rot: 0, fronds: 11 }, variants: [
    { id: 'tall', label: 'Tall', params: {} }, { id: 'young', label: 'Young', params: { h: 5.5, lean: 0.1, fronds: 9 } },
    { id: 'leaning', label: 'Leaning', params: { h: 9.5, lean: 0.35, fronds: 13 } },
  ] };
export const hibiscusBush = { id: 'driftwood-isle/hibiscus-bush', seed: 0x5ea1 ^ 0xb5 ^ 0xe116,
  defaults: { r: 1.3, flowers: true, phase: 0 }, variants: [
    { id: 'flowering', label: 'In flower', params: {} }, { id: 'leaf', label: 'Leaf only', params: { flowers: false } },
    { id: 'small', label: 'Small', params: { r: 0.8 } },
  ] };

/** Original bent trunk contacts, evaluated only by the author job. */
export function palmColliders(p: PalmParams): ColliderDesc[] {
  const axis = (t: number): Vector3 => { const off = p.lean * p.h * (t * t - 0.12 * Math.sin(t * Math.PI)); return new Vector3(Math.cos(p.leanDir) * off, p.h * t, Math.sin(p.leanDir) * off); };
  const out: ColliderDesc[] = [], cuts = [0, 1 / 3, 2 / 3, 1];
  for (let k = 0; k < 3; k++) {
    const t0 = cuts[k] ?? 0, t1 = cuts[k + 1] ?? 1, p0 = axis(t0), p1 = axis(t1);
    if (k === 0) p0.y -= 0.3;
    const along = p1.clone().sub(p0), len = along.length(), radius = 0.3 * (1 - t0 * 0.45);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along.divideScalar(len));
    out.push({ kind: 'capsule', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2, halfHeight: len / 2, radius, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
  }
  return out;
}
