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
const writer = byteWriter(process.argv.includes('--check'), 'nine-declarations');
writer.put(fileURLToPath(new URL('../data/declarations.generated.json', import.meta.url)),
  encodeCanonicalJson({ audio: ND_AUDIO, clientChannels: parseClientChannels(NINE_CLIENT_CHANNELS) }));
writer.put(fileURLToPath(new URL('../data/worldRows.generated.json', import.meta.url)), encodeCanonicalJson(world));
writer.finish();
