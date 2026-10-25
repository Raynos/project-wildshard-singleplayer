// Build-only geometry inventory for worlds whose boot still assembles copies.
// Persist exact matrices beside a local geometry pool; the painter never boots
// a shard or runs a model factory.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { readBakedGeometry } from '../src/sdk/kit/bakedGeometry.ts';
import { _applyChunkConstants } from '../src/engine/core/config.ts';
import { configureLevel } from '../src/engine/level/selection.ts';
import { placeForest } from '../src/engine/world/forest/placement.ts';

export function mapForest(constants, field, forest, variants) {
  _applyChunkConstants(constants);
  configureLevel({ id: constants.slug, ground: { terrain: field }, forest });
  return placeForest(variants).trees;
}

export function mapBinary(file, shuffled = false) {
  const bytes = new Uint8Array(inflateSync(readFileSync(file)));
  if (!shuffled) return bytes;
  const out = new Uint8Array(bytes.length), n = bytes.length / 4;
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = bytes[b * n + i];
  return out;
}
export function mapGeometry(bytes, offset, row) {
  const geometry = readBakedGeometry(bytes, offset, row);
  if (!row.expand || geometry.index === null) return geometry;
  const expanded = geometry.toNonIndexed(); geometry.dispose(); return expanded;
}
