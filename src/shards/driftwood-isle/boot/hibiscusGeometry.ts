import { BufferAttribute, BufferGeometry } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { modelGeometry } from '../runtime/boot/modelGeometry';
import { HIBISCUS_FILES } from '../data/hibiscusFiles';
import type { HibiscusBushParams } from '../models/hibiscusBush';

const files = HIBISCUS_FILES[TIER === 'phone' ? 'phone' : 'desktop'];
const variants = { flowering: modelGeometry(files.flowering, { _sway: 'aSway' }), leaf: modelGeometry(files.leaf, { _sway: 'aSway' }), small: modelGeometry(files.small, { _sway: 'aSway' }) };
let ready = false;
/** Explorer's three authored variants; world batches never retain these templates. */
export async function loadHibiscusVariants(): Promise<void> { await Promise.all(Object.values(variants).map(template => template.load())); ready = true; }
export function hibiscusVariantsReady(): boolean { return ready; }
/** Admit only the three authored specimen shapes; arbitrary runtime shapes have no procedural fallback. */
export function copyHibiscusVariant(p: HibiscusBushParams): BufferGeometry {
  if (p.phase !== 0) throw new Error('Hibiscus specimen phase has no authored bake');
  const key = p.r === 1.3 ? (p.flowers ? 'flowering' : 'leaf') : p.r === 0.8 && p.flowers ? 'small' : null;
  if (key === null) throw new Error('Hibiscus specimen has no authored bake');
  return variants[key].copy();
}
/** Validate and transfer one compacted world batch into independently owned attributes.
 * The transport and parser keep no template. Separate buffers let GPU-only channels release independently. */
export function decodeHibiscusWorld(input: Uint8Array, copies: number): { geometry: BufferGeometry; boxes: Float32Array } {
  if (input.byteOffset % 4 !== 0 || input.byteLength < 16 || input.byteLength > 32_000_000) throw new Error('Invalid hibiscus geometry transport');
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const vertices = view.getUint32(8, true), count = view.getUint32(12, true);
  if (view.getUint32(0, true) !== 0x31424948 || view.getUint32(4, true) !== 1 || count !== copies || count > 512 || vertices === 0 || vertices > 400_000 || vertices % 3 !== 0 || input.byteLength !== 16 + (count * 6 + vertices * 11) * 4) throw new Error('Hibiscus world topology differs from its authored batch');
  const values = new Float32Array(input.buffer, input.byteOffset + 16, (input.byteLength - 16) / 4);
  if (values.some(value => !Number.isFinite(value))) throw new Error('Nonfinite hibiscus geometry');
  const boxes = values.slice(0, count * 6), geometry = new BufferGeometry(); let offset = count * 6;
  for (const [name, width] of [['position', 3], ['normal', 3], ['color', 3], ['aSway', 2]] as const) {
    const end = offset + vertices * width; geometry.setAttribute(name, new BufferAttribute(values.slice(offset, end), width)); offset = end;
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, boxes };
}
/** One per-world owned read, with immutable content admission before any mesh is returned. */
export async function loadHibiscusWorld(copies: number): Promise<ReturnType<typeof decodeHibiscusWorld>> {
  const response = await fetch(files.world, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Hibiscus world load failed (${response.status})`);
  const input = new Uint8Array(await response.arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input)), value => value.toString(16).padStart(2, '0')).join('');
  if (!files.world.includes(hash)) throw new Error('Hibiscus world content hash differs');
  return decodeHibiscusWorld(input, copies);
}
