#!/usr/bin/env node
// E435 / G227: pin the existing world inputs before any tile conversion. No scene or physics allocation.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIDES = ['north', 'east', 'south', 'west'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Check the native lattice without resampling. Boundary values must agree bit-for-bit with declared rows. */
export function nativeTerrainWitness(bytes, edges) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 24 || view.getUint32(0, true) !== 0x52545357 || view.getUint32(4, true) !== 1 || view.getUint32(8, true) !== 256 || view.getFloat32(12, true) !== 500 || view.getUint32(16, true) !== 0x4a1a || bytes.byteLength < 24 + 256 ** 2 * 8) throw new Error('Nalati native WSTR256 header/payload changed');
  const heights = Array.from({ length: 256 ** 2 }, (_, i) => view.getFloat32(24 + i * 4, true));
  if (heights.some(value => !Number.isFinite(value))) throw new Error('Nalati native height is nonfinite');
  const boundaries = {};
  for (const side of SIDES) {
    const indices = Array.from({ length: 256 }, (_, k) => (side === 'north' ? 255 : side === 'south' ? 0 : k) * 256 + (side === 'east' ? 255 : side === 'west' ? 0 : k));
    const row = edges[side]?.heights;
    if (row?.length !== 256 || indices.some((index, k) => !Object.is(heights[index], row[k]))) throw new Error(`Nalati ${side} native boundary differs from the declared edge`);
    const raw = Buffer.alloc(256 * 4);
    indices.forEach((index, k) => { raw.writeFloatLE(heights[index], k * 4); });
    boundaries[side] = { samples: 256, sha256: hash(raw) };
  }
  // Every lattice cell intersecting each closed 8x15 socket must be flat: checking its four corners
  // proves the entire bilinear footprint, rather than checking only its centre or a sparse sample.
  const entries = SIDES.map(side => {
    const bounds = side === 'north' ? [-4, 4, 235, 250] : side === 'south' ? [-4, 4, -250, -235] : side === 'east' ? [235, 250, -4, 4] : [-250, -235, -4, 4];
    const [minX, maxX, minZ, maxZ] = bounds;
    const startX = Math.max(0, Math.floor((minX + 250) * 255 / 500)), endX = Math.min(255, Math.ceil((maxX + 250) * 255 / 500));
    const startZ = Math.max(0, Math.floor((minZ + 250) * 255 / 500)), endZ = Math.min(255, Math.ceil((maxZ + 250) * 255 / 500));
    let corners = 0;
    for (let z = startZ; z <= endZ; z++) for (let x = startX; x <= endX; x++) {
      if (heights[z * 256 + x] !== 0) throw new Error(`Nalati ${side} entry footprint is not flat at y=0`);
      corners++;
    }
    return { side, bounds, y: 0, area: 120, nativeCorners: corners };
  });
  return { format: 'WSTR', version: 1, resolution: 256, size: 500, seed: 0x4a1a, bytes: bytes.byteLength, sha256: hash(bytes),
    samples: heights.length, heightsSha256: hash(bytes.subarray(24, 24 + 256 ** 2 * 4)), splatSha256: hash(bytes.subarray(24 + 256 ** 2 * 4, 24 + 256 ** 2 * 8)),
    min: Math.min(...heights), max: Math.max(...heights), boundaries, entries };
}

/** Deterministic input inventory. File bytes are source wire bytes, not a fabricated resident-cost estimate. */
export function inventoryNalatiWorld(root, edges) {
  const inspect = path => { const bytes = readFileSync(resolve(root, path)); return { path, bytes: bytes.length, sha256: hash(bytes) }; };
  const files = directory => readdirSync(resolve(root, directory)).sort().flatMap(name => {
    const path = `${directory}/${name}`;
    return statSync(resolve(root, path)).isDirectory() ? files(path) : [inspect(path)];
  });
  const source = 'src/shards/nalati-grasslands';
  return { version: 1, terrain: nativeTerrainWitness(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')), edges),
    sourceFiles: [...files(`${source}/world`), ...files(`${source}/look`), ...files(`${source}/models`), ...['layout.ts', 'outcrops.ts', 'cragRock.ts', 'terrainSurface.ts'].map(name => inspect(`${source}/${name}`))].sort((a, b) => a.path.localeCompare(b.path)),
    modelInputs: files('public/assets/nalati/models'), textureInputs: files('public/assets/nalati/tex'),
    hierarchy: [{ lod: 0, size: 62.5, count: 64 }, { lod: 1, size: 125, count: 16 }, { lod: 'far', size: 500, count: 1 }],
    preserveTerrainAttributes: ['position', 'normal', 'color', 'surf', 'rdir', 'zone'],
    hybridBoundaries: ['animated/awakened balbals', 'flutter cloth', 'smoke', 'water animation', 'grass/wind', 'ambient life', 'moving herds', 'weather', 'creatures', 'quests', 'combat'],
    costs: { status: 'unbaked', note: 'Per-tile and resident costs require emitted bytes; input sizes are not admission costs.' } };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const { NALATI_EDGES } = await import('../../src/shards/nalati-grasslands/data/edges.ts');
  const report = inventoryNalatiWorld(root, NALATI_EDGES);
  if (relative(root, process.cwd()).startsWith('..')) throw new Error('Run the inventory from the repository or its scratch export');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
