import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeCasts, bakeFixedKits, readFixedSlots } from './casts.ts';

const root = resolve(import.meta.dirname, '../../../..');
const output = resolve(root, 'public/assets/nine-dragon/baked/casts');
mkdirSync(output, { recursive: true });
const layout = JSON.parse(readFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/layout.generated.json'), 'utf8'), (_key, value) => value === '-0' ? -0 : value);
const fixed = bakeFixedKits(readFixedSlots(layout)), casts = await bakeCasts(url => new Uint8Array(readFileSync(resolve(root, `public${url}`))));
for (const [name, bytes] of [...casts, ...fixed.packs]) {
  writeFileSync(resolve(output, `${name}.glb`), bytes);
  console.info(`Nine ${name}: ${bytes.length} bytes`);
}
writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/fixedKits.generated.json'), `${JSON.stringify({ signs: fixed.signs, lanterns: fixed.lanterns },
  (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value)}\n`);
