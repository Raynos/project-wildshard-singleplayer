import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { readImagePixels } from '../../../../src/sdk/bake/image.ts';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import paint from '../data/paint.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import canopy from '../data/canopy.json' with { type: 'json' };
import filament from '../data/filament.json' with { type: 'json' };

const root = new URL('../../../../public/assets/nine-dragon/paint/', import.meta.url);
const output = {};
for (const [tier, size] of Object.entries(paint.sizes)) {
  const parts = [];
  for (const [layer, row] of paint.layers.entries()) {
    const image = async suffix => {
      const url = new URL(`${row.name}${suffix}${tier === 'phone' ? '.phone.webp' : '.jpg'}`, root);
      const decoded = await readImagePixels(new Uint8Array(readFileSync(url)), { flipY: true });
      if (decoded.width === size && decoded.height === size) return decoded.pixels;
      const pixels = new Uint8Array(size * size * 4), source = decoded.pixels;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const sx = Math.max(0, Math.min(decoded.width - 1, (x + 0.5) * decoded.width / size - 0.5));
        const sy = Math.max(0, Math.min(decoded.height - 1, (y + 0.5) * decoded.height / size - 0.5));
        const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(x0 + 1, decoded.width - 1), y1 = Math.min(y0 + 1, decoded.height - 1);
        const fx = sx - x0, fy = sy - y0;
        for (let c = 0; c < 4; c++) pixels[(y * size + x) * 4 + c] = Math.round(
          (source[(y0 * decoded.width + x0) * 4 + c] * (1 - fx) + source[(y0 * decoded.width + x1) * 4 + c] * fx) * (1 - fy)
          + (source[(y1 * decoded.width + x0) * 4 + c] * (1 - fx) + source[(y1 * decoded.width + x1) * 4 + c] * fx) * fy);
      }
      return pixels;
    };
    const rgb = await image(''), alpha = row.alpha ? await image('-a') : null;
    const data = Uint8Array.from(rgb);
    for (let i = 0; i < size * size; i++) data[i * 4 + 3] = alpha === null ? 128 : alpha[i * 4];
    for (let offset = 0; offset < data.length; offset += paint.chunkBytes) {
      const bytes = data.subarray(offset, offset + paint.chunkBytes);
      parts.push({ layer, offset, packed: Buffer.from(deflateSync(bytes, { level: 9 })).toString('base64') });
    }
  }
  output[tier] = { size, layers: paint.layers.length, parts };
}
const writer = byteWriter(process.argv.includes('--check'), 'nine-paint-array');
writer.put(fileURLToPath(new URL('../data/paintArray.generated.json', import.meta.url)), JSON.stringify(output));
const shape = value => Array.isArray(value) ? `readonly [${value.map(shape).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).map(([key, child]) => `readonly ${JSON.stringify(key)}:${shape(child)}`).join(';')}}`
  : JSON.stringify(value);
writer.put(fileURLToPath(new URL('../data/paint.d.json.ts', import.meta.url)), `declare const paint: ${shape(paint)};\nexport default paint;\n`);
writer.put(fileURLToPath(new URL('../data/light.d.json.ts', import.meta.url)), `declare const light: ${shape(light)};\nexport default light;\n`);
writer.put(fileURLToPath(new URL('../data/canopy.d.json.ts', import.meta.url)), `declare const canopy: ${shape(canopy)};\nexport default canopy;\n`);
writer.put(fileURLToPath(new URL('../data/filament.d.json.ts', import.meta.url)), `declare const filament: ${shape(filament)};\nexport default filament;\n`);
writer.finish();
