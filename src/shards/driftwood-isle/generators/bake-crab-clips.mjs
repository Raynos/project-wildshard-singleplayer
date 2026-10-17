import { CRAB_CLIPS } from './crabClips.ts';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const writer = byteWriter(process.argv.includes('--check'), 'crab-clips');
writer.put(fileURLToPath(new URL('../data/crabClips.generated.json', import.meta.url)), encodeCanonicalJson(CRAB_CLIPS));
writer.finish();
