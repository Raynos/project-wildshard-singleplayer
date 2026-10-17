import { SAILOR_CLIPS, CAPTAIN_CLIPS } from './humanoidClips.ts';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const writer = byteWriter(process.argv.includes('--check'), 'humanoid-clips');
writer.put(fileURLToPath(new URL('../data/sailorClips.generated.json', import.meta.url)), encodeCanonicalJson(SAILOR_CLIPS));
writer.put(fileURLToPath(new URL('../data/captainClips.generated.json', import.meta.url)), encodeCanonicalJson(CAPTAIN_CLIPS));
writer.finish();
