import type { BufferGeometry } from 'three';
import { decodeFoliageWorld, readFoliageWorld } from '../../boot/foliageGeometry';
import { TIER } from '@wildshard/engine/core/tier';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { HIBISCUS_FILES } from '../../data/hibiscusFiles';
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
const layout = { magic: 0x31424948, channels: [['position', 3], ['normal', 3], ['color', 3], ['aSway', 2]] } as const;
/** Independent releasable attributes and the original full-copy boxes. */
export function decodeHibiscusWorld(input: Uint8Array, copies: number): ReturnType<typeof decodeFoliageWorld> { return decodeFoliageWorld(input, copies, layout); }
/** World loading never retains the optional Explorer templates. */
export function loadHibiscusWorld(copies: number): ReturnType<typeof readFoliageWorld> { return readFoliageWorld(files.world, copies, layout); }
