import {parseAudioData} from '@wildshard/sdk/audio';
import source from '../data/audioSource.json' with {type:'json'};
import patches from '../data/voicePatches.json' with {type:'json'};
import scene from '../data/audioScene.json' with {type:'json'};
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {byteWriter} from '../../../../scripts/bake-output.mjs';
import {fileURLToPath} from 'node:url';

const NALATI_AUDIO=parseAudioData({patches,scene,...source});
const writer=byteWriter(process.argv.includes('--check'),'audio-section');
writer.put(fileURLToPath(new URL('../data/audio.generated.json',import.meta.url)),encodeCanonicalJson({audio:NALATI_AUDIO}));
writer.finish();
