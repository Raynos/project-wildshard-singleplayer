import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW } from '@wildshard/engine/core/config';
import { parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { validateEntrywayGrid, type ShardEntryways } from './entryways';

/** Original native WSTR terrain retained by a trusted world-only hybrid; this declaration never installs collision. */
export const NativeGroundSchema = v.strictObject({ version: v.literal(1), file: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) });
/** The immutable native payload; resolution, seed and landscape identity derive from admitted bytes. */
export type NativeGround = v.InferOutput<typeof NativeGroundSchema>;
interface NativeGroundSource {
  nativeGround: NativeGround | null;
  runtime: object | null;
  terrain: object | null;
  meshCollision: object | null;
  identity: { seed: number };
  files: readonly { hash: string; kind: string; dependencies: readonly string[] }[];
  critical: readonly string[];
  edge: Record<ShardEntryways[number]['edge'], { heights: readonly number[] }>;
  entryways: ShardEntryways;
}
/** Native ground is an independent critical root with one trusted collision owner, never another compiled collider. */
export function nativeGroundRules(source: NativeGroundSource): string[] {
  const data = source.nativeGround; if (data === null) return [];
  const errors: string[] = [];
  if (source.runtime === null) errors.push('native ground requires a trusted runtime declaration');
  if (source.terrain !== null || source.meshCollision !== null) errors.push('native ground and compiled collision are mutually exclusive');
  const file = source.files.find(row => row.hash === data.file);
  if (file?.kind !== 'binary' || file.dependencies.length > 0 || !source.critical.includes(data.file)) errors.push('native ground is an independent critical binary root');
  return errors;
}
/** Parse the same original payload as the live terrain after bounding its header, then witness every native sample and entry. */
export function validateNativeGround(source: NativeGroundSource, assets: ReadonlyMap<string, Uint8Array>): BakedGrid | null {
  const errors = nativeGroundRules(source); if (errors.length > 0) throw new Error(errors.join('; '));
  const data = source.nativeGround; if (data === null) return null;
  const bytes = assets.get(data.file); if (bytes === undefined || bytes.length < 24) throw new Error('Missing native ground bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x52545357 || view.getUint32(4, true) !== 1 || view.getUint32(8, true) !== 256 || view.getFloat32(12, true) !== 500 || view.getUint32(16, true) !== source.identity.seed) throw new Error('Native ground requires original WSTR v1 / 256 / 500 m / identity seed');
  // Bound the placement trailer before the legacy parser can allocate its authored counts array.
  const end = 24 + 256 ** 2 * 8;
  if (bytes.length < end) throw new Error('Truncated native ground lattice');
  if (bytes.length > end) {
    if (bytes.length < end + 24 || view.getUint32(end, true) !== 0x4c505357 || view.getUint32(end + 4, true) !== 1) throw new Error('Invalid native ground placement trailer');
    const decisions = view.getUint32(end + 8, true), kinds = view.getUint32(end + 12, true);
    if (kinds > 256 || decisions > 8_000_000 || bytes.length !== end + 24 + kinds * 4 + Math.ceil(decisions / 8)) throw new Error('Native ground placement trailer exceeds bounded format');
    if (!Number.isFinite(view.getFloat64(end + 16 + kinds * 4, true))) throw new Error('Invalid native ground placement checksum');
  }
  const grid = parseBakedTerrain(Uint8Array.from(bytes).buffer);
  if (grid === null || grid.heights.some(height => !Number.isFinite(height) || height < -CELL_BELOW || height > CELL_ABOVE)) throw new Error('Native ground heights must be finite and within the cell');
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const row = source.edge[side].heights;
    if (row.length !== 256) throw new Error('Native ground needs exact full 256 boundary rows');
    for (let i = 0; i < 256; i++) {
      const x = side === 'east' ? 255 : side === 'west' ? 0 : i, z = side === 'north' ? 255 : side === 'south' ? 0 : i;
      if (row[i] !== grid.heights[z * 256 + x]) throw new Error(`Native ground ${side} boundary differs from original bytes`);
    }
  }
  validateEntrywayGrid(source.entryways, { resolution: grid.res, size: grid.size, x: -250, z: -250, heights: grid.heights });
  return grid;
}
