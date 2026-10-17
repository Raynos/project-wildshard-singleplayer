import { MONKEY_CLIPS } from './monkeyClips.ts';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const writer = byteWriter(process.argv.includes('--check'), 'monkey-clips');
writer.put(fileURLToPath(new URL('../data/monkeyClips.generated.json', import.meta.url)), encodeCanonicalJson(MONKEY_CLIPS));
writer.finish();
