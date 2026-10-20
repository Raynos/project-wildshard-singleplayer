import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeLods } from './lods.ts';
import { hookProduct } from './hookProduct.ts';
import { FRAMES, deckParts } from './floorRows.ts';
import { bakeCasts, bakeFixedKits, readFixedSlots } from './casts.ts';

const root = resolve(import.meta.dirname, '../../../..');
const output = resolve(root, 'public/assets/nine-dragon/baked/casts');
mkdirSync(output, { recursive: true });
const layout = JSON.parse(readFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/layout.generated.json'), 'utf8'), (_key, value) => value === '-0' ? -0 : value);
const lods = await bakeLods(url => new Uint8Array(readFileSync(resolve(root, `public${url}`))));
const floors = FRAMES.map(frame => { const s = deckParts(frame).slab; return { x:s.x, z:s.z, hw:s.sx/2, hd:s.sz/2, y:0 }; });
const fixed = bakeFixedKits(readFixedSlots(layout)), casts = await bakeCasts(url => new Uint8Array(readFileSync(resolve(root, `public${url}`))));
for (const [name, bytes] of [...casts, ...fixed.packs, ...lods]) {
  writeFileSync(resolve(output, `${name}.glb`), bytes);
  console.info(`Nine ${name}: ${bytes.length} bytes`);
}
writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/fixedKits.generated.json'), `${JSON.stringify({ signs: fixed.signs, lanterns: fixed.lanterns },
  (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value)}\n`);

writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/deckFloors.generated.json'), `${JSON.stringify(floors)}\n`);
writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/castHook.generated.json'), `${JSON.stringify({
  ...await hookProduct(url => new Uint8Array(readFileSync(resolve(root, `public${url}`)))),
  casts: [...new Map([...casts, ...fixed.packs, ...lods])].map(([name, bytes]) => ({ name, glb: Buffer.from(bytes).toString('base64') })),
})}\n`);
