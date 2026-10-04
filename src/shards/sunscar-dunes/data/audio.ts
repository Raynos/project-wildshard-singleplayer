import { parseAudioData } from '@wildshard/sdk/audio';
import { CUES } from './cues';

/** Today's kit voices and intentionally silent score, without added ambience or samples. */
export const AUDIO = parseAudioData({ cues: [], ambience: null, score: 'silent', routing: [
    { id: CUES.fire, actions: [{ voice: 'kit.swordSwing' }] },
    { id: CUES.heavy, actions: [{ voice: 'kit.swordHeavy' }] },
    { id: CUES.impact, actions: [{ voice: 'kit.swordHit' }] },
    { id: CUES.reload, actions: [{ voice: 'kit.reload' }] },
    { id: 'cue.swap', actions: [{ voice: 'kit.weaponSwap' }] },
] });
