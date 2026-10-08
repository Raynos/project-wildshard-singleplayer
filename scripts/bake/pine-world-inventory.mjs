#!/usr/bin/env node
// E435 / G227: witness existing Pine world inputs before conversion; no scene or physics allocation.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sides = ['north', 'east', 'south', 'west'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Pin the native payload, placement decisions, rounded declarations and every entry-intersecting cell. */
export function pineTerrainWitness(bytes, metadata, declaredEdges) {
  if (bytes.length < 24) throw new Error('Pine native WSTR256 header missing');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = 256 ** 2;
  if (view.getUint32(0, true) !== 0x52545357 || view.getUint32(4, true) !== 1 || view.getUint32(8, true) !== 256 || view.getFloat32(12, true) !== 500 || view.getUint32(16, true) !== 1337 || bytes.length < 24 + count * 8) throw new Error('Pine native WSTR256 header changed');
  const heights = Array.from({ length: count }, (_, i) => view.getFloat32(24 + i * 4, true));
  if (heights.some(h => !Number.isFinite(h) || Math.abs(h) > 250)) throw new Error('Pine native height invalid');
  const boundaries = {};
  for (const side of sides) {
    const raw = Buffer.alloc(256 * 4), row = declaredEdges[side]; let roundingError = 0;
    if (row?.length !== 256) throw new Error(`Pine ${side} declaration needs 256 samples`);
    for (let i = 0; i < 256; i++) {
      const x = side === 'east' ? 255 : side === 'west' ? 0 : i, z = side === 'north' ? 255 : side === 'south' ? 0 : i;
      const height = heights[z * 256 + x]; raw.writeFloatLE(height, i * 4);
      if (Math.round(height * 1000) / 1000 !== row[i]) throw new Error(`Pine ${side} rounded declaration differs from native boundary`);
      roundingError = Math.max(roundingError, Math.abs(height - row[i]));
    }
    boundaries[side] = { samples: 256, sha256: sha256(raw), declarationPrecisionMetres: 0.001, maxRoundingError: roundingError };
  }
  const entries = sides.map(side => {
    const bounds = side === 'north' ? [-4, 4, 235, 250] : side === 'south' ? [-4, 4, -250, -235] : side === 'east' ? [235, 250, -4, 4] : [-250, -235, -4, 4];
    const [x0, x1, z0, z1] = bounds; let corners = 0;
    for (let z = Math.max(0, Math.floor((z0 + 250) * 255 / 500)); z <= Math.min(255, Math.ceil((z1 + 250) * 255 / 500)); z++) {
      for (let x = Math.max(0, Math.floor((x0 + 250) * 255 / 500)); x <= Math.min(255, Math.ceil((x1 + 250) * 255 / 500)); x++) {
        if (heights[z * 256 + x] !== 0) throw new Error(`Pine ${side} native entry footprint is not flat at y=0`);
        corners++;
      }
    }
    return { side, bounds, area: 120, y: 0, nativeCorners: corners };
  });
  if (metadata.hash !== sha256(bytes) || metadata.bytes !== bytes.length || metadata.res !== 256 || metadata.size !== 500 || metadata.seed !== 1337 || metadata.landscapeHash !== view.getUint32(20, true)) throw new Error('Pine terrain metadata differs from immutable bytes');
  return { format: 'WSTR', version: 1, resolution: 256, samples: count, size: 500, seed: 1337,
    bytes: bytes.length, sha256: sha256(bytes), heightsSha256: sha256(bytes.subarray(24, 24 + count * 4)), splatSha256: sha256(bytes.subarray(24 + count * 4, 24 + count * 8)),
    placementSha256: sha256(bytes.subarray(24 + count * 8)), min: Math.min(...heights), max: Math.max(...heights), boundaries, entries };
}

/** Deterministic source inventory; source wire sizes are deliberately not resident-cost estimates. */
export function inventoryPineWorld(root, edges) {
  const inspect = path => { const bytes = readFileSync(resolve(root, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) }; };
  const files = directory => readdirSync(resolve(root, directory)).sort().flatMap(name => {
    const path = `${directory}/${name}`;
    return statSync(resolve(root, path)).isDirectory() ? files(path) : [inspect(path)];
  });
  const source = 'src/shards/pine-hollow', bake = 'public/assets/baked/pine-hollow';
  const metadata = JSON.parse(readFileSync(resolve(root, `${bake}/terrain.json`), 'utf8'));
  return { version: 1, terrain: pineTerrainWitness(readFileSync(resolve(root, `${bake}/terrain.bin`)), metadata, edges),
    sourceFiles: [...files(`${source}/world`), ...files(`${source}/models`), ...files(`${source}/look`), inspect(`${source}/layout.ts`)].sort((a, b) => a.path.localeCompare(b.path)),
    assetInputs: ['public/assets/models', 'public/assets/gpu/models'].flatMap(base => readdirSync(resolve(root, base)).sort().filter(name => name.startsWith('pine-hollow-')).flatMap(name => files(`${base}/${name}`))),
    bakedInputs: files(bake),
    hierarchy: [{ lod: 0, size: 62.5, count: 64 }, { lod: 1, size: 125, count: 16 }, { lod: 'far', size: 500, count: 1 }],
    preserveTerrainAttributes: ['position', 'normal', 'uv', 'splat', 'canopy'],
    staticBuilders: ['cabins', 'props', 'drawnModels', 'landmarks', 'crags', 'forest tree set'],
    hybridBoundaries: ['cabin doors', 'beaver sluice', 'zipline', 'water animation', 'wind/undergrowth', 'particles', 'quests', 'creatures', 'combat'],
    costs: { status: 'unbaked', note: 'Emitted tile bytes and shared texture dependencies determine cost; no content or material may be dropped to hide an overage.' } };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const { PINE_EDGE_HEIGHTS } = await import('../../src/shards/pine-hollow/data/edges.ts');
  process.stdout.write(`${JSON.stringify(inventoryPineWorld(root, PINE_EDGE_HEIGHTS), null, 2)}\n`);
}
