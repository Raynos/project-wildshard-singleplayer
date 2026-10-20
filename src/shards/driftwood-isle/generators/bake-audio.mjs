// Validate authored content before emitting the existing audio/audio section.
import cove from '../data/coveComposition.json' with {type:'json'};
import source from '../data/audioSource.json' with {type:'json'};
import {parseAudioData} from '@wildshard/format/audio';
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {byteWriter} from '../../../../scripts/bake-output.mjs';
import {fileURLToPath} from 'node:url';

const writer=byteWriter(process.argv.includes('--check'),'audio-section');
writer.put(fileURLToPath(new URL('../data/audio.generated.json',import.meta.url)),encodeCanonicalJson({audio:parseAudioData({...source.audio,gameplay:{...source.audio.gameplay,constants:{cove:{fall:cove.audioFall,cave:cove.audioCave,caveBounds:cove.audioBounds}}}})}));
writer.finish();
