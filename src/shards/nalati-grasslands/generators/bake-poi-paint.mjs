// Retain the exact Mac/V8 float bytes of the former live callers; readers are portable.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { shepherdBody, shepherdArm } from './shepherd.ts';
import { letteringGeometry } from './signLettering.ts';
import { boardSpots } from './painted.ts';
import { writeGeometry, join } from './geometryWriter.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = file => JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data', file), 'utf8'));
const signs = read('places.json').rows.find(row => row.name === 'roads').anchors.signposts;
const defaults = read('campCatalogue.json').find(row => row.key === 'signpostBaked').model.defaults;
const posts = signs.map(s => ({ spots: boardSpots(s.x, s.z, s.y, s.boards), boards: s.boards }));
let totalBytes = 0;
const fingerprint = createHash('sha256');
const rows = [
  ['shepherd-body', shepherdBody()], ['shepherd-arm', shepherdArm()],
  ['sign-labels:roads', letteringGeometry(posts)],
  ['sign-labels:specimen', letteringGeometry([{ spots: boardSpots(0, 0, 0, defaults.boards), boards: defaults.boards }])],
].map(([key, geometry]) => {
  const blocks = [], row = writeGeometry(geometry, blocks, key), bytes = join(blocks);
  totalBytes += bytes.length; fingerprint.update(bytes); geometry.dispose();
  return { key, geometry: row, data: deflateSync(bytes, { level: 9 }).toString('base64') };
});
const writer = byteWriter(process.argv.includes('--check'), 'nalati-poi-paint');
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/poiPaint.json'), jsonBytes({ bin: fingerprint.digest('hex'), bytes: totalBytes, rows }));
writer.finish();
console.log(`${rows.length} fixed paint meshes, ${totalBytes} raw bytes`);
