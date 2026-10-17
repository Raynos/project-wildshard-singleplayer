import * as THREE from 'three';
import type { InferOutput } from 'valibot';
import { ResourceMemo } from '@wildshard/engine/app/cachedAssets';
import { loadTexture } from '@wildshard/engine/core/assets';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';

/** Pine's painted textures, baked offline (generators/bake-pine-painted.mjs): the product's `custom/paintedTextures`. */
type PaintedRows = InferOutput<(typeof SECTIONS)['custom/paintedTextures']>;
/** One of Pine's painted textures: log ends, lamp glow, coat, chalk. */
export type PaintedKey = keyof PaintedRows['textures'];

const textures = new ResourceMemo<PaintedKey, THREE.Texture>();
let admitted: { readonly rows: PaintedRows; readonly url: (name: string) => string } | null = null;

/** Admit the product's painted rows once per runtime (the world hook, before anything loads a painted texture). */
export function admitPaintedTextures(product: ShardProduct): void {
  admitted = { rows: product.section('custom/paintedTextures', SECTIONS), url: (name) => product.url(name) };
}
function paintedRows(): NonNullable<typeof admitted> {
  if (admitted === null) throw new Error('[pine-hollow] painted textures are not admitted');
  return admitted;
}

/** Load a painted texture once and share it; a missing file refuses (there is no runtime painter). */
export function loadPainted(key: PaintedKey): Promise<THREE.Texture> {
  const { rows, url } = paintedRows(), row = rows.textures[key];
  return textures.load(key, () => loadTexture(url(row.url), row.srgb, 1, undefined, (t) => { if (!row.repeat) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }));
}

/** A painted texture `loadPainted` already loaded; refuses before then. */
export function painted(key: PaintedKey): THREE.Texture {
  const t = textures.peek(key);
  if (t === undefined) throw new Error(`[pine-hollow] painted texture ${key} is not loaded`);
  return t;
}
