import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { bakedSpill } from './spillBake.ts';
import { byteWriter } from '../../../../scripts/bake-output.mjs';

const rows = [];
for (const tier of ['phone', 'desktop']) for (const caps of [false, true]) {
  const { geometry, emitters } = bakedSpill(caps, tier);
  let bytes = 0;
  for (const [name, mesh] of geometry) {
    const attribute = mesh.getAttribute('aSpill');
    if (!(attribute.array instanceof Float32Array)) throw new Error('Spill is not float32');
    const values = attribute.array;
    for (let i = 0; i < values.length; i += 196608) {
      const path = `lighting/spill/${tier}/${caps ? 'capped' : 'open'}/${name}-${i / 196608}.bin`;
      const tag = new TextEncoder().encode(path), header = 4 + Math.ceil(tag.length / 4) * 4;
      const part = values.subarray(i, i + 196608), raw = new Uint8Array(header + part.byteLength);
      new DataView(raw.buffer).setUint32(0, tag.length, true); raw.set(tag, 4);
      raw.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), header);
      const packed = deflateSync(raw, { level: 9 }); bytes += packed.length;
      rows.push({ name: path, decoded: raw.length, packed: packed.toString('base64') });
    }
    mesh.dispose();
  }
  console.log(`Nine spill ${tier}/${caps ? 'capped' : 'open'}: ${geometry.size} draws, ${emitters.length} emitters, ${bytes} compressed bytes`);
}
const writer = byteWriter(process.argv.includes('--check'), 'nine-light-spill');
writer.put(fileURLToPath(new URL('../data/lightSpill.generated.json', import.meta.url)), Buffer.from(`${JSON.stringify(rows)}\n`));
writer.finish();
