import { parseAudioData } from '@wildshard/sdk/audio';
import { CUES } from './cues';

/** Today's kit voices and intentionally silent score, without added ambience or samples. */
export const AUDIO = parseAudioData({ cues: [], ambience: null, score: 'silent', routing: [
    { id: CUES.fire, actions: [{ voice: 'sword.swing' }] },
    { id: CUES.heavy, actions: [{ voice: 'sword.heavy' }] },
    { id: CUES.impact, actions: [{ voice: 'sword.hit' }] },
    { id: 'cue.swap', actions: [{ voice: 'weapon.swap' }] },
] });
