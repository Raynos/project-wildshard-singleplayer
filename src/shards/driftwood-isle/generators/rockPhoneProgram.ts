import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compactChannels } from './compactChannels';
import { decimateFlatBatch } from './phoneDecimate';

/** L18.3e (G769): how far (m) the phone's simplified rocks may move a surface (board art/driftwood-isle/round-20-phone-decimation) */
const PHONE_ROCK_ERROR = 0.05;
/** the rock bank's models (rockBank.ts: the two batches and the Explorer specimens); a missing desktop GLB throws */
const ids = ['shore', 'small', 'shoreBoulder-medium', 'shoreBoulder-small', 'shoreBoulder-big', 'smallRock-round', 'smallRock-flat', 'smallRock-big', 'reefRock-mossy', 'reefRock-bare', 'reefRock-tall'];
const sourceOf = (id: string): string => `models/rocks/${id}.glb`;

const layout = (): Error => new Error('Driftwood rock GLB layout differs');
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
function field(value: unknown, key: string): unknown { if (!isRecord(value)) throw layout(); return value[key]; }
function item(value: unknown, at: unknown): unknown {
  if (!Array.isArray(value) || typeof at !== 'number') throw layout();
  const list: readonly unknown[] = value; return list[at];
}
function count(value: unknown, fallback?: number): number {
  const out = value === undefined ? fallback : value; if (typeof out !== 'number' || !Number.isSafeInteger(out) || out < 0) throw layout(); return out;
}

/** The desktop rock as the bake writes it (one unindexed primitive: float32 position, normalized Int8 normal and Uint16
 *  colour, tightly packed) back as float channels. */
function readRock(glb: Uint8Array): BufferGeometry {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength), length = view.getUint32(12, true);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(24 + length, true) !== 0x004e4942) throw layout();
  const doc: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(glb.subarray(20, 20 + length))), bin = glb.subarray(28 + length);
  const primitive = item(field(item(field(doc, 'meshes'), 0), 'primitives'), 0);
  if (field(primitive, 'indices') !== undefined) throw layout();
  const geometry = new BufferGeometry(), data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (const [semantic, name, width] of [['POSITION', 'position', 3], ['NORMAL', 'normal', 3], ['COLOR_0', 'color', 3]] as const) {
    const accessor = item(field(doc, 'accessors'), field(field(primitive, 'attributes'), semantic));
    const range = item(field(doc, 'bufferViews'), field(accessor, 'bufferView')), type = field(accessor, 'componentType'), n = count(field(accessor, 'count'));
    const size = type === 5126 ? 4 : type === 5123 ? 2 : type === 5120 ? 1 : 0; if (size === 0) throw layout();
    const offset = count(field(range, 'byteOffset'), 0) + count(field(accessor, 'byteOffset'), 0), stride = count(field(range, 'byteStride'), width * size);
    const values = new Float32Array(n * width);
    for (let i = 0; i < n; i++) for (let c = 0; c < width; c++) {
      const at = offset + i * stride + c * size;
      values[i * width + c] = type === 5126 ? data.getFloat32(at, true) : type === 5123 ? data.getUint16(at, true) / 65535 : Math.max(-1, data.getInt8(at) / 127);
    }
    geometry.setAttribute(name, new BufferAttribute(values, width));
  }
  return geometry;
}

/** The phone's rocks within PHONE_ROCK_ERROR (smooth normals and colours kept), simplified from the desktop rocks at
 *  product build from the rock bank's desktop GLBs (by product name): owned bytes, never generated assets under src (GR0). */
export function driftwoodPhoneRockOutput(desktop: ReadonlyMap<string, Uint8Array>): EmittedBlobs {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.82 });
  const files = new Map(ids.map(id => {
    const glb = desktop.get(sourceOf(id)); if (glb === undefined) throw new Error(`Missing desktop rock ${id}`);
    return [`${id}-phone.glb`, staticGlb([{ geometry: compactChannels(decimateFlatBatch(readRock(glb), PHONE_ROCK_ERROR, 'smooth')), material, compactIndex: true, quantizedChannels: true }])];
  }));
  material.dispose();
  return emitNamedBlobs(ids.map(id => {
    const bytes = files.get(`${id}-phone.glb`); if (bytes === undefined) throw new Error(`Missing phone rock ${id}`);
    return nameBlob(`models/rocks/${id}-phone.glb`, 'glb', bytes);
  }));
}
