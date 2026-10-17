// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-pickups.mjs [--check]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zlibSync, unzlibSync } from 'fflate';
import { authoredPickups } from '../src/game/generators/pickups.ts';
import { byteWriter, jsonBytes } from './bake-output.mjs';
import { installKitProps } from '../src/game/models/interact.ts';
import { Interactables, Live } from '../src/engine/world/interact/Interactables.ts';
import { pickupLook, registerPickupLook } from '../src/engine/world/interact/types.ts';
import { readBakedGeometry } from '../src/game/plugin/geometry.ts';
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/data/interactables.ts';
import { DRIFTWOOD_INTERACT as LEGACY_DRIFTWOOD } from '../src/shards/driftwood-isle-legacy/quest/interactables.ts';
import { pineTableFromPlacements } from '../src/shards/pine-hollow/generators/questTable.ts';
import { pineTable as legacyPineTable, RESIN_COUNT, TOKEN_NAMES } from '../src/shards/pine-hollow-legacy/quest/table.ts';

const seed = 0x1a7e, variants = new Map(), traces = {};
const spots = JSON.parse(readFileSync(new URL('../src/shards/pine-hollow/data/spots.generated.json', import.meta.url), 'utf8'));
const pine = pineTableFromPlacements(spots.rows);
const legacyPine = legacyPineTable({ resin: Array.from({ length: RESIN_COUNT }, () => ({ x: 0, z: 0 })),
  tokens: TOKEN_NAMES.map(() => ({ x: 0, z: 0 })), dam: { x: 0, z: 0, fx: 0, fz: 1, ax: 1, az: 0 },
  finder: { x: 0, y: 0, z: 0 }, bench: { x: 0, y: 0, z: 0, yaw: 0 } });
const add = (part, value) => {
  const key = `${part.key}:${value}`;
  if (!variants.has(key)) variants.set(key, { part, seed: value });
};
installKitProps();
for (const row of authoredPickups) registerPickupLook(row.id, { ...row,
  parts: row.parts.map(part => {
    const bound = { key: part.key, batch: part.batch, geometry: value => { add(part, value); return part.geometry(value); } };
    if ('bob' in part) bound.bob = part.bob;
    if ('pulse' in part) bound.pulse = part.pulse;
    return bound;
  }),
});
// Run the actual engine cache and seed counter; visibility and saved flags never skip construction.
for (const [name, table] of Object.entries({ 'driftwood-isle': DRIFTWOOD_INTERACT, 'pine-hollow': pine,
  'driftwood-isle-legacy': LEGACY_DRIFTWOOD, 'pine-hollow-legacy': legacyPine })) {
  const flags = { has: () => false }, runner = new Interactables({ flags }), rows = [], seeds = new Map();
  const original = runner.geo.bind(runner);
  runner.geo = (key, batch, make) => original(key, batch, () => {
    seeds.set(key, runner.seed); return make();
  });
  for (const def of table.rows) {
    runner.parts(new Live(def, flags));
    if (def.kind === 'pickup' || def.kind === 'altar') {
      const parts = pickupLook(def.kind === 'pickup' ? def.look : def.socketLook)?.parts ?? [];
      rows.push({ id: def.id, kind: def.kind, parts: parts.slice(0, def.kind === 'altar' ? 1 : parts.length)
        .map(part => ({ key: part.key, seed: seeds.get(part.key) })) });
    }
  }
  traces[name] = rows;
  for (const pending of runner.pending) pending.geo.dispose();
}
// Every Explorer model uses the original default seed; loot uses its independent fixed seed.
for (const row of authoredPickups) for (const part of row.parts) add(part, seed);
const coin = authoredPickups.find(row => row.id === 'coin').parts[0]; add(coin, 0xc01);
// The retained shelf bake and frozen legacy shelf use one independently coloured token per slot.
const token = authoredPickups.find(row => row.id === 'token').parts[0];
for (let i = 0; i < 8; i++) add(token, 1000 + i);

let rawBytes = 0, compressedBytes = 0;
const geometries = [...variants.values()].map(({ part, seed: value }) => {
  const geometry = part.geometry(value), chunks = [];
  if (geometry.index !== null || geometry.groups.length > 0) throw new Error('Pickup bake requires original unindexed draws');
  const attrs = Object.entries(geometry.attributes).map(([name, attribute]) => {
    if (!(attribute.array instanceof Float32Array)) throw new Error(`Unsupported pickup attribute ${name}`);
    chunks.push(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    return [name, 'f32', attribute.itemSize, attribute.normalized];
  });
  const row = { attrs, count: geometry.getAttribute('position').count, index: null, indexCount: 0,
    box: geometry.boundingBox !== null, expand: false };
  const bytes = Buffer.concat(chunks), compressed = zlibSync(bytes), restored = readBakedGeometry(unzlibSync(compressed), 0, row);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const actual = restored.getAttribute(name).array;
    if (!Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)
      .equals(Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength))) throw new Error(`Pickup byte mismatch ${part.key}:${value}:${name}`);
  }
  if (!geometry.boundingBox.equals(restored.boundingBox) || !geometry.boundingSphere.equals(restored.boundingSphere)) throw new Error(`Pickup bounds mismatch ${part.key}:${value}`);
  rawBytes += bytes.length; compressedBytes += compressed.length;
  geometry.dispose(); restored.dispose();
  return { key: part.key, seed: value, geometry: row, data: Buffer.from(compressed).toString('base64') };
});
const looks = authoredPickups.map(row => ({ id: row.id, model: row.model, name: row.name, batch: row.batch, lift: row.lift,
  parts: row.parts.map(({ geometry: _geometry, ...part }) => part) }));
const rows = { file: 'src/game/generators/pickups.ts', seed, coin: coin.key, geometries, looks };
const writer = byteWriter(process.argv.includes('--check'), 'pickup-bake');
writer.put(fileURLToPath(new URL('../src/game/data/pickupCatalogue.json', import.meta.url)), jsonBytes(rows));
writer.finish();
console.log(JSON.stringify({ variants: geometries.length, rawBytes, compressedBytes, encodedBytes: geometries.reduce((n, row) => n + row.data.length, 0), traces }, null, 2));
