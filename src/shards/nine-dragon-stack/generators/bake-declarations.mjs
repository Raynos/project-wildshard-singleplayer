import { readFileSync } from 'node:fs';
import { worldRows } from './worldRows.ts';
import { ND_AUDIO } from './audio.ts';
import { NINE_CLIENT_CHANNELS } from './clientMotion.ts';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

// Compile author recipes once; both the admitted product and the decorative client read these exact rows.
const layout = JSON.parse(readFileSync(new URL('../data/layout.generated.json', import.meta.url), 'utf8'), (_key, value) => value === '-0' ? -0 : value);
const world = await worldRows(layout.rows, layout.records, url => new Uint8Array(readFileSync(new URL(`../../../../public${url}`, import.meta.url))));
// the layout bake's whole tiles: which tiles hold each partition, and whether the page loads it at boot (not Explorer-only)
const baked = JSON.parse(readFileSync(new URL('../data/world.generated.json', import.meta.url), 'utf8')), wholeTiles = {};
for (const [kind, hashes] of [...Object.entries(baked.libraries), ['layout', baked.props.tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? []))]]) for (const hash of hashes) {
  const bytes = readFileSync(new URL(`../assets/${hash}`, import.meta.url));
  for (const node of JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + bytes.readUInt32LE(12)))).nodes ?? []) {
    const id = node.extras?.wholePartition?.id; if (typeof id !== 'string') continue;
    const row = wholeTiles[id] ??= { files: [], resident: false };
    if (!row.files.includes(hash)) row.files.push(hash);
    if (kind !== 'explorer') row.resident = true;
  }
}
const writer = byteWriter(process.argv.includes('--check'), 'nine-declarations');
writer.put(fileURLToPath(new URL('../data/declarations.generated.json', import.meta.url)),
  encodeCanonicalJson({ audio: ND_AUDIO, clientChannels: parseClientChannels(NINE_CLIENT_CHANNELS) }));
writer.put(fileURLToPath(new URL('../data/worldRows.generated.json', import.meta.url)), encodeCanonicalJson({ ...world, wholeTiles }));
writer.finish();
