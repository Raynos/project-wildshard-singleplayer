import { resolve } from 'node:path';
import { zlibSync } from 'fflate';
import { Rng } from '@wildshard/engine/core/rng';
import { SEED, TERRAIN, RIVER, BRIDGE, SPAWN, groundColor, surfaceAt, zoneAt, riverMask, brookMask, loneSpruceMask, inSpruceClearing, edgeBermAt } from './terrainRecipe.ts';
import { edgeSpruceMask } from './edgeRecipe.ts';
import { nalatiWetAt } from './wetRecipe.ts';
import { NALATI_MINIMAP } from './minimapRecipe.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const res = 256, size = 500;
const forestMask = (x, z) => inSpruceClearing(x, z) ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)));
const names = ['river', 'brook', 'pond', 'wet', 'forest', 'valley', 'bowl', 'snow', 'red', 'green', 'blue', 'gravel', 'rock', 'ice', 'mapRed', 'mapGreen', 'mapBlue'];
const arrays = Object.fromEntries(names.map(name => [name, new Float32Array(res * res)]));
const rgb = [0, 0, 0], map = [0, 0, 0];
for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
  const x = -size / 2 + i * size / (res - 1), z = -size / 2 + j * size / (res - 1), k = j * res + i;
  const h = TERRAIN.heightAt(x, z), slope = 1 - TERRAIN.normalAt(x, z)[1], forest = forestMask(x, z);
  const zones = zoneAt(x, z), surface = surfaceAt(x, z, h, slope);
  groundColor(x, z, h, slope, TERRAIN, rgb); NALATI_MINIMAP.ground(x, z, h, slope, forest, map);
  const values = [riverMask(x, z), brookMask(x, z), Math.max(riverMask(x, z), brookMask(x, z)), Number(nalatiWetAt(x, z)), forest, ...zones, ...rgb, ...surface, ...map];
  names.forEach((name, channel) => { arrays[name][k] = values[channel]; });
}
const encode = array => Buffer.from(zlibSync(new Uint8Array(array.buffer))).toString('base64');
const rng = new Rng(SEED + 4242), marks = [];
for (let x = -247; x < 247; x += 4.2) for (let z = -247; z < 247; z += 4.2) {
  const cx = x + rng.range(-1.6, 1.6), cz = z + rng.range(-1.6, 1.6);
  if (rng.next() > forestMask(cx, cz) * 0.85) continue;
  const r = 1.6 + rng.range(0, 1.1), fill = rng.next() < .5 ? '#2c4a30' : '#38583a';
  marks.push({ kind: 'dot', x: cx + .8, z: cz + .8, r, fill: 'rgba(14, 26, 18, 0.45)' }, { kind: 'dot', x: cx, z: cz, r, fill });
}
const profile = Array.from({ length: 501 }, (_, i) => [RIVER.z(i - 250), RIVER.half(i - 250)]);
const data = { res, size, seed: SEED, spawn: SPAWN, bridge: BRIDGE, river: { level: RIVER.level, profile },
  channels: Object.fromEntries(Object.entries(arrays).map(([key, values]) => [key, encode(values)])),
  map: { ground: { base: [92, 128, 58], layers: [] }, segments: [],
    trails: [{ width: 6, style: 'rgba(70, 54, 36, 0.8)' }, { width: 3.5, style: '#b89c70' }], marks, pois: NALATI_MINIMAP.pois() } };
const writer = byteWriter(process.argv.includes('--check'), 'nalati-geography');
writer.put(resolve(import.meta.dirname, '..', 'boot', 'geography.generated.json'), jsonBytes(data, 0));
writer.put(resolve(import.meta.dirname, '..', 'boot', 'geography.generated.d.json.ts'), Buffer.from("import type { GeographyRows } from '../data/geographyTypes';\ndeclare const rows: GeographyRows;\nexport default rows;\n"));
writer.put(resolve(import.meta.dirname, '..', 'data', 'ridingTerrain.generated.json'), jsonBytes({ res, size, water: RIVER.level, wet: data.channels.wet, pond: data.channels.pond }, 0));
writer.finish();
