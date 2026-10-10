/**
 * Pine Hollow's timber landmarks from their offline bakes (G285, SF72 "bake the code-built worlds"). A timber's builder runs
 * at build time (`../generators/timberBake.ts` records what it leaves: each material's parts and the glass as float32
 * attribute blocks in a binary, the colliders, deck floors and anchors as a row); here a row and its blocks become the
 * timber again, ready to `finish` (./timber.ts `Timber.baked`), exactly as the builder's own timber was.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MatKey } from './homestead';
import { Timber } from './timber';

const num = v.pipe(v.number(), v.finite());
const xyz = v.strictObject({ x: num, y: num, z: num });
const Surface = v.optional(v.picklist(['wood', 'stone']));
const Box = v.strictObject({ kind: v.literal('box'), x: num, y: num, z: num, hx: num, hy: num, hz: num, yaw: v.optional(num), rot: v.optional(v.strictObject({ x: num, y: num, z: num, w: num })), surface: Surface });
const Treads = v.strictObject({ kind: v.literal('treads'), from: xyz, to: xyz, width: num, count: num, surface: Surface });
const Floor = v.strictObject({ x: num, z: num, rot: num, hw: num, hd: num, y: num });
/** the timber kit's materials (homestead.ts `MatKey`) */
const MAT_KEYS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly MatKey[];
const Part = v.strictObject({ key: v.picklist(MAT_KEYS), counts: v.array(num) });
/** a baked timber's row: its parts' vertex counts per material (in the builder's order), the glass's, its facts */
export const TIMBER_ROW = { parts: v.array(Part), glass: v.array(num), colliders: v.array(v.variant('kind', [Box, Treads])), floors: v.array(Floor), anchors: v.record(v.string(), v.tuple([num, num, num])) };
export const TimberRowSchema = v.strictObject(TIMBER_ROW);
export type TimberRow = v.InferOutput<typeof TimberRowSchema>;
export type ColliderRow = TimberRow['colliders'][number];

/** the attribute blocks of each part, in the binary's order: position (3), normal (3), uv (2), float32, non-indexed */
export const TIMBER_ATTRS = [['position', 3], ['normal', 3], ['uv', 2]] as const;

/** A bake's float32 blocks, read in order: each timber takes its parts' and glass's blocks as fresh geometries. */
export class TimberBlocks {
  private at = 0;
  private readonly floats: Float32Array;
  constructor(bytes: Uint8Array, expected: number) {
    if (bytes.byteLength !== expected) throw new Error(`[timber] the bake holds ${String(bytes.byteLength)} bytes, its rows ${String(expected)}`);
    this.floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  }
  private geometry(n: number): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    for (const [name, size] of TIMBER_ATTRS) { g.setAttribute(name, new THREE.BufferAttribute(this.floats.slice(this.at, this.at + n * size), size)); this.at += n * size; }
    return g;
  }
  /** the next timber's parts and glass */
  parts(row: TimberRow): { parts: Map<MatKey, THREE.BufferGeometry[]>; glass: THREE.BufferGeometry[] } {
    const parts = new Map<MatKey, THREE.BufferGeometry[]>();
    for (const { key, counts } of row.parts) parts.set(key, counts.map((n) => this.geometry(n)));
    return { parts, glass: row.glass.map((n) => this.geometry(n)) };
  }
  /** the next timber, unfinished */
  timber(name: string, row: TimberRow): Timber {
    const { parts, glass } = this.parts(row);
    const anchors = Object.fromEntries(Object.entries(row.anchors).map(([k, p]) => [k, new THREE.Vector3(...p)]));
    return Timber.baked(name, parts, glass, { colliders: row.colliders.map(colliderOf), floors: row.floors, anchors });
  }
  /** pass over a timber's blocks without reading them */
  skip(row: TimberRow): void {
    const per = TIMBER_ATTRS.reduce((n, [, size]) => n + size, 0);
    for (const n of [...row.parts.flatMap((p) => p.counts), ...row.glass]) this.at += n * per;
  }
  /** every block read (a check after the last timber) */
  done(): void { if (this.at !== this.floats.length) throw new Error('[timber] the bake is longer than its rows'); }
}

/** a collider row as the timber kit made it */
function colliderOf(c: ColliderRow): ColliderDesc {
  const surface = c.surface === undefined ? {} : { surface: c.surface };
  if (c.kind === 'treads') return { kind: 'treads', from: c.from, to: c.to, width: c.width, count: c.count, ...surface };
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.rot === undefined ? {} : { rot: c.rot }), ...surface };
}
