import { CELL_ABOVE, CELL_BELOW } from '@wildshard/format/contentBounds';
import { parseBakedTerrain, type BakedGrid } from '@wildshard/format/bakedTerrainBytes';
import { validateEntrywayGrid } from '@wildshard/format/entrywayAssets';

import { nativeGroundRules, type NativeGroundSource } from '@wildshard/format/nativeGround';

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
