import { ND_AUDIO } from './audio.ts';
import { NINE_CLIENT_CHANNELS } from './clientMotion.ts';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

// Compile author recipes once; both the admitted product and the decorative client read these exact rows.
const writer = byteWriter(process.argv.includes('--check'), 'nine-declarations');
writer.put(fileURLToPath(new URL('../data/declarations.generated.json', import.meta.url)),
  encodeCanonicalJson({ audio: ND_AUDIO, clientChannels: parseClientChannels(NINE_CLIENT_CHANNELS) }));
writer.finish();
