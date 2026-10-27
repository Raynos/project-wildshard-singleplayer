/** S3 immutable backing for independently evictable road geometry. Uses the
 * existing hash-verifying content store; it installs no cache or worker. */
import * as v from 'valibot';
import { BufferAttribute, BufferGeometry, Sphere, Vector3, type TypedArray } from 'three';
import type { ContentCache } from '@wildshard/engine/boot/contentCache';
import type { Scope } from '@wildshard/engine/app/scope';
import { contentHash } from '../shardfile/contentStore';
import type { RoadTileGeometry } from './roadTileGeometry';

const MAX_BYTES = 25_000_000, MAX_HEADER = 65_536;
const scalar = v.picklist(['f32', 'f64', 'u8', 'u8c', 'i8', 'u16', 'i16', 'u32', 'i32']);
type Scalar = v.InferOutput<typeof scalar>;
const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(MAX_BYTES));
const finite = v.pipe(v.number(), v.finite());
interface Header {
  version: 1; tile: [number, number]; vertices: number; runs: number[]; lod: number[];
  sphere: [number, number, number, number];
  attributes: { name: string; scalar: Scalar; size: number; normalized: boolean }[];
}
const headerSchema: v.GenericSchema<unknown, Header> = v.strictObject({ version: v.literal(1),
  tile: v.tuple([v.pipe(v.number(), v.safeInteger()), v.pipe(v.number(), v.safeInteger())]), vertices: natural,
  runs: v.pipe(v.array(natural), v.minLength(1), v.maxLength(8)),
  lod: v.pipe(v.array(v.pipe(finite, v.minValue(0))), v.maxLength(7)),
  sphere: v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))]),
  attributes: v.pipe(v.array(v.strictObject({ name: v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/u)), scalar,
    size: v.pipe(natural, v.minValue(1), v.maxValue(16)), normalized: v.boolean() })), v.minLength(1), v.maxLength(32)),
});
/** Disk-backed immutable bytes are outside the resident tile budget; decoded arrays are admitted by the caller. */
export type RoadTileStore = Pick<ContentCache, 'get' | 'put' | 'pin'>;
export interface RoadTileReference {
  readonly hash: string; readonly wireBytes: number;
  readonly x: number; readonly z: number;
  readonly jsBytes: number; readonly gpuBytes: number;
}
function scalarKind(array: TypedArray): Scalar {
  if (array instanceof Float32Array) return 'f32';
  if (array instanceof Float64Array) return 'f64';
  if (array instanceof Uint8ClampedArray) return 'u8c';
  if (array instanceof Uint8Array) return 'u8';
  if (array instanceof Int8Array) return 'i8';
  if (array instanceof Uint16Array) return 'u16';
  if (array instanceof Int16Array) return 'i16';
  if (array instanceof Uint32Array) return 'u32';
  if (array instanceof Int32Array) return 'i32';
  throw new Error('Unsupported road tile scalar');
}
function scalarBytes(kind: Scalar): number {
  switch (kind) {
    case 'u8': case 'u8c': case 'i8': return 1;
    case 'u16': case 'i16': return 2;
    case 'u32': case 'i32': case 'f32': return 4;
    case 'f64': return 8;
    default: throw new Error('Unsupported road tile scalar');
  }
}
function ownedAttribute(kind: Scalar, buffer: ArrayBuffer): TypedArray {
  switch (kind) {
    case 'f32': return new Float32Array(buffer);
    case 'f64': return new Float64Array(buffer);
    case 'u8': return new Uint8Array(buffer);
    case 'u8c': return new Uint8ClampedArray(buffer);
    case 'i8': return new Int8Array(buffer);
    case 'u16': return new Uint16Array(buffer);
    case 'i16': return new Int16Array(buffer);
    case 'u32': return new Uint32Array(buffer);
    case 'i32': return new Int32Array(buffer);
    default: throw new Error('Unsupported road tile scalar');
  }
}
function live(scope: Scope): void {
  if (scope.disposed || scope.disposing) throw new Error('Road tile owner retired');
}
/** Pack original scalar bytes, including normalized integer attributes. The header
 * and each run are length checked before any decoded geometry is allocated. */
export function encodeRoadTile(tile: RoadTileGeometry): Uint8Array<ArrayBuffer> {
  const bin = tile.plan.bins[0], position = tile.geometry.getAttribute('position');
  if (tile.plan.bins.length !== 1 || bin?.tile === undefined || position === undefined) throw new Error('Expected one owned road tile');
  const attributes: Header['attributes'] = [], blocks: Uint8Array[] = [];
  let at = 0;
  for (const run of [bin, ...bin.levels]) {
    if (run.start !== at || run.count % 3 !== 0) throw new Error('Road tile runs are not contiguous triangles');
    at += run.count;
  }
  if (at !== tile.plan.source.length || tile.plan.lod.length !== bin.levels.length) throw new Error('Road tile run mismatch');
  for (const name of Object.keys(tile.geometry.attributes)) {
    const attribute = tile.geometry.getAttribute(name);
    if (!(attribute instanceof BufferAttribute) || attribute.count !== position.count) throw new Error('Invalid road tile attribute');
    attributes.push({ name, scalar: scalarKind(attribute.array), size: attribute.itemSize, normalized: attribute.normalized });
    blocks.push(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  const header = v.parse(headerSchema, { version: 1, tile: [bin.tile.x, bin.tile.z], vertices: position.count,
    runs: [bin.count, ...bin.levels.map(run => run.count)], lod: [...tile.plan.lod],
    sphere: [bin.sphere.center.x, bin.sphere.center.y, bin.sphere.center.z, bin.sphere.radius], attributes });
  const metadata = new TextEncoder().encode(JSON.stringify(header));
  const index = new Uint8Array(tile.plan.source.buffer, tile.plan.source.byteOffset, tile.plan.source.byteLength);
  const vertexBytes = blocks.reduce((sum, block) => sum + block.length, 0);
  if (tile.bytes.jsBytes !== vertexBytes + index.length * 2 || tile.bytes.gpuBytes !== vertexBytes + index.length) throw new Error('Road tile byte plan mismatch');
  const bytes = 4 + metadata.length + vertexBytes + index.length;
  if (metadata.length > MAX_HEADER || bytes > MAX_BYTES) throw new Error('Road tile archive exceeds its bound');
  const packed = new Uint8Array(bytes);
  new DataView(packed.buffer).setUint32(0, metadata.length, true); packed.set(metadata, 4);
  let offset = 4 + metadata.length;
  for (const block of [...blocks, index]) { packed.set(block, offset); offset += block.length; }
  return packed;
}
/** Decode from an owned snapshot; no attribute or index aliases archive bytes. */
export function decodeRoadTile(input: Uint8Array): RoadTileGeometry {
  if (input.length < 4 || input.length > MAX_BYTES) throw new Error('Invalid road tile archive length');
  const bytes = Uint8Array.from(input), metadataLength = new DataView(bytes.buffer).getUint32(0, true);
  if (metadataLength === 0 || metadataLength > MAX_HEADER || metadataLength + 4 > bytes.length) throw new Error('Invalid road tile header length');
  const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(4, 4 + metadataLength)));
  const header = v.parse(headerSchema, json), names = new Set(header.attributes.map(attribute => attribute.name));
  if (!names.has('position') || names.size !== header.attributes.length || header.runs.length !== header.lod.length + 1
    || header.runs.some(count => count % 3 !== 0)) throw new Error('Invalid road tile header');
  const vertexBytes = header.attributes.reduce((sum, attribute) => sum + header.vertices * attribute.size * scalarBytes(attribute.scalar), 0);
  const indexCount = header.runs.reduce((sum, count) => sum + count, 0), offset = metadataLength + 4;
  if (offset + vertexBytes + indexCount * 4 !== bytes.length) throw new Error('Road tile archive size mismatch');
  const geometry = new BufferGeometry();
  try {
    let at = offset;
    for (const attribute of header.attributes) {
      const length = header.vertices * attribute.size * scalarBytes(attribute.scalar);
      const array = ownedAttribute(attribute.scalar, bytes.slice(at, at + length).buffer);
      geometry.setAttribute(attribute.name, new BufferAttribute(array, attribute.size, attribute.normalized)); at += length;
    }
    const index = new Uint32Array(bytes.slice(at).buffer);
    if (index.some(vertex => vertex >= header.vertices)) throw new Error('Road tile index outside vertex table');
    const position = geometry.getAttribute('position');
    if (position.itemSize !== 3) throw new Error('Invalid road tile positions');
    for (const value of position.array) if (!Number.isFinite(value)) throw new Error('Invalid road tile positions');
    const runs: { start: number; count: number }[] = []; let start = 0;
    for (const count of header.runs) { runs.push({ start, count }); start += count; }
    const fine = runs[0]; if (fine === undefined) throw new Error('Missing road tile fine run');
    const sphere = new Sphere(new Vector3(header.sphere[0], header.sphere[1], header.sphere[2]), header.sphere[3]);
    geometry.setIndex(new BufferAttribute(index, 1)); geometry.setDrawRange(0, fine.count); geometry.boundingSphere = sphere;
    return { geometry, plan: { source: index, lod: header.lod, bins: [{ sphere: sphere.clone(), start: 0, count: fine.count,
      levels: runs.slice(1), tile: { x: header.tile[0], z: header.tile[1] } }] },
      bytes: { jsBytes: vertexBytes + index.byteLength * 2, gpuBytes: vertexBytes + index.byteLength } };
  } catch (error) { geometry.dispose(); throw error; }
}
/** Pin before durable publication. A refusal leaves the caller's original geometry
 * owned and usable; only the caller may retire it after this reference returns. */
export async function persistRoadTile(scope: Scope, store: RoadTileStore, tile: RoadTileGeometry): Promise<RoadTileReference> {
  live(scope);
  const identity = tile.plan.bins[0]?.tile;
  if (identity === undefined) throw new Error('Missing road tile identity');
  const reference = { x: identity.x, z: identity.z, jsBytes: tile.bytes.jsBytes, gpuBytes: tile.bytes.gpuBytes };
  const bytes = encodeRoadTile(tile), hash = await contentHash(bytes); live(scope);
  const release = store.pin([hash]), cancel = scope.capture('disposers', release);
  try {
    live(scope);
    if (!await store.put(hash, bytes)) throw new Error('Road tile archive storage refused');
    live(scope);
    return { hash, wireBytes: bytes.length, ...reference };
  } catch (error) { cancel(); release(); throw error; }
}
/** Existing cache reads are verified; the explicit reference also fences identity,
 * length and decoded admission bytes before its geometry can be published. */
export async function loadRoadTile(scope: Scope, store: RoadTileStore, reference: RoadTileReference): Promise<RoadTileGeometry> {
  live(scope); const bytes = await store.get(reference.hash); live(scope);
  if (bytes === null || bytes.length !== reference.wireBytes || await contentHash(bytes) !== reference.hash) throw new Error('Road tile archive unavailable');
  live(scope); const tile = decodeRoadTile(bytes), identity = tile.plan.bins[0]?.tile;
  if (identity?.x !== reference.x || identity.z !== reference.z || tile.bytes.jsBytes !== reference.jsBytes || tile.bytes.gpuBytes !== reference.gpuBytes) {
    tile.geometry.dispose(); throw new Error('Road tile reference mismatch');
  }
  scope.own(tile.geometry);
  return tile;
}
