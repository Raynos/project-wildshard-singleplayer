/**
 * Recording a timber landmark for its offline bake (G285). Build-time only: a generator builds a timber (../world/timber.ts)
 * and hands it here before `finish`; each material's parts and the glass go into the binary as float32 attribute blocks
 * (non-indexed: position, normal, uv), the rest into the timber's row. The page reads them back in the same order
 * (../world/timberBake.ts `TimberBlocks`).
 */
import type * as THREE from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { Timber } from '../world/timber';
import { TIMBER_ATTRS, type ColliderRow, type TimberRow } from '../world/timberBake';

/** +0 for -0 (JSON writes both as 0; a quaternion's -0 turns nothing) */
const z0 = (n: number): number => n + 0;

/** a collider as its row: the timber kit's boxes (turned by a yaw or a quaternion) and treads, wood or stone */
function colliderRow(c: ColliderDesc): ColliderRow {
  const surface = c.surface === 'wood' || c.surface === 'stone' ? { surface: c.surface } : {};
  if (c.surface !== undefined && !('surface' in surface)) throw new Error(`[timber] a collider of ${c.surface}`);
  if (c.kind === 'treads') return { kind: 'treads', from: { ...c.from }, to: { ...c.to }, width: c.width, count: c.count, ...surface };
  if (c.kind !== 'box') throw new Error(`[timber] a ${c.kind} collider`);
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }),
    ...(c.rot === undefined ? {} : { rot: { x: z0(c.rot.x), y: z0(c.rot.y), z: z0(c.rot.z), w: z0(c.rot.w) } }), ...surface };
}

/** The bake's binary, timber by timber, and each timber's row. */
export class TimberRecorder {
  private readonly blocks: Float32Array[] = [];

  private counts(list: readonly THREE.BufferGeometry[]): number[] {
    return list.map((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      if (Object.keys(g.attributes).sort().join(',') !== 'normal,position,uv') throw new Error(`[timber] a part carries ${Object.keys(g.attributes).join(',')}`);
      for (const [name, size] of TIMBER_ATTRS) {
        const a = g.getAttribute(name);
        if (!(a.array instanceof Float32Array) || a.itemSize !== size || a.normalized) throw new Error(`[timber] ${name} is not float32 x ${String(size)}`);
        this.blocks.push(a.array.slice(0, a.count * size));
      }
      return g.getAttribute('position').count;
    });
  }

  /** record a built (unfinished) timber: its blocks appended to the binary, its row returned */
  record(t: Timber): TimberRow {
    const { parts, glass } = t.built();
    const partRows = [...parts].map(([key, list]) => ({ key, counts: this.counts(list) }));
    const glassRow = this.counts(glass);
    const facts = t.facts();
    const xyz = (p: THREE.Vector3): [number, number, number] => [p.x, p.y, p.z];
    const anchors = Object.fromEntries(Object.entries(facts.anchors).map(([k, p]) => [k, xyz(p)]));
    return { parts: partRows, glass: glassRow, colliders: facts.colliders.map(colliderRow), floors: [...facts.floors], anchors };
  }

  /** every recorded block, in order */
  bin(): Uint8Array {
    const bin = new Uint8Array(this.blocks.reduce((n, b) => n + b.byteLength, 0));
    let at = 0;
    for (const b of this.blocks) { bin.set(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), at); at += b.byteLength; }
    return bin;
  }
}
