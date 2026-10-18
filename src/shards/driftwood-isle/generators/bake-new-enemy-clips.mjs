import { BRINE_PUFFER_CLIPS, CONCH_DUELIST_CLIPS, SPLINTER_MANTIS_CLIPS } from './driftwoodRegularClips.ts';
import { BELLBACK_CLIPS, TIDE_ROOT_COLOSSUS_CLIPS } from './tidalGiantsClips.ts';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';
const writer = byteWriter(process.argv.includes('--check'), 'driftwood-new-enemy-clips');
for (const [name, clips] of [['brinePuffer', BRINE_PUFFER_CLIPS], ['conchDuelist', CONCH_DUELIST_CLIPS], ['splinterMantis', SPLINTER_MANTIS_CLIPS], ['bellback', BELLBACK_CLIPS], ['tideRootColossus', TIDE_ROOT_COLOSSUS_CLIPS]])
  writer.put(fileURLToPath(new URL(`../data/${name}Clips.generated.json`, import.meta.url)), encodeCanonicalJson(clips));
writer.finish();
