import { pineSkyChannels } from './skyChannels.ts';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const writer = byteWriter(process.argv.includes('--check'), 'sky-channels');
writer.put(fileURLToPath(new URL('../data/skyChannels.generated.json', import.meta.url)), encodeCanonicalJson({ clientChannels: parseClientChannels(pineSkyChannels()) }));
writer.finish();
