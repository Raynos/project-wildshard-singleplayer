// Fixed geometry and ordered support hulls over the shipping native terrain.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { bakeCragRockOnTerrain } from './places.ts';
import { writeGeometry, join } from './geometryWriter.ts';

const root = resolve(import.meta.dirname, '../../../..');
const terrain = readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin'));
const blocks = [];
let offset = 0;
const build = tier => {
  const made = bakeCragRockOnTerrain(tier === 'phone', terrain);
  const meshes = made.meshes.map(({ name, geometry }) => {
    const key = `crag:${tier}:${name}`, start = blocks.length;
    const part = { key, offset, row: writeGeometry(geometry, blocks, key) };
    offset += blocks.slice(start).reduce((bytes, block) => bytes + block.length, 0);
    geometry.dispose();
    return part;
  });
  return { meshes, recipe: { version: 1, root: 'root', materials: [{ kind: 'port', id: 'crag', source: 'crag' }],
    nodes: [{ kind: 'group', id: 'root', name: 'nalati-crag-rock', children: made.meshes.map(row => row.name) },
      ...made.meshes.map((row, i) => ({ kind: 'mesh', id: row.name, name: row.name, geometry: meshes[i].key,
        material: 'crag', missing: 'omit', castShadow: true, receiveShadow: true }))] },
    placements: made.placements, boxes: made.boxes, colliders: made.colliders, count: made.count, triangles: made.triangles,
    hulls: made.descs.map(row => {
      if (row.kind !== 'hull') throw new Error('Crag bake requires the original support hulls');
      return { x: row.x, y: row.y, z: row.z, points: Array.from(row.points) };
    }) };
};
const rows = { phone: build('phone'), desktop: build('desktop') }, raw = join(blocks);
const lanes = new Uint8Array(raw.length), words = raw.length / 4;
for (let i = 0; i < words; i++) for (let b = 0; b < 4; b++) lanes[b * words + i] = raw[i * 4 + b];
const writer = byteWriter(process.argv.includes('--check'), 'nalati-crags');
writer.put(resolve(root, 'public/assets/nalati/baked/crags.bin'), deflateSync(lanes, { level: 9 }));
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/cragRock.generated.json'), jsonBytes(rows));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/cragRock.generated.json'), jsonBytes(rows));
writer.finish();
