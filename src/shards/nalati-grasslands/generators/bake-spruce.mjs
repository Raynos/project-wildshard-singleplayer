// Exact crown/trunk buffers, compiled offline; the page retains material and forest ownership.
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { GeometryPackWriter } from '@wildshard/sdk/kit/geometryPack';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { spruceGeometry } from './spruceGeometry.ts';

const root = resolve(import.meta.dirname, '../../../..');
const pack = new GeometryPackWriter('Nalati spruce');
const variants = spruceGeometry().map(v => {
  const row = { height: v.height, trunkRadius: v.trunkRadius, trunk: pack.add(v.trunk), cardsHi: pack.add(v.cardsHi), cardsLo: pack.add(v.cardsLo), twigs: pack.add(v.twigs), far: pack.add(v.far) };
  for (const key of ['trunk', 'cardsHi', 'cardsLo', 'twigs', 'far']) v[key].dispose();
  return row;
});
const writer = byteWriter(process.argv.includes('--check'), 'nalati-spruce');
writer.put(resolve(root, 'public/assets/nalati/baked/spruce.bin'), deflateSync(pack.bytes(), { level: 9 }));
writer.put(resolve(root, 'public/assets/nalati/baked/spruce.json'), jsonBytes({ pack: pack.rows(), variants }));
writer.finish();
