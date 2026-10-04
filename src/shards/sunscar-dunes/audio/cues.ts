import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCues } from '@wildshard/engine/combat/cues';
import { sharedWeaponVoices } from '@wildshard/kit/audio/weaponVoices';

/** The bullwhip's cues. Until the locally generated crack lands (README leftovers) they play kit voices. */
export const CUES = { fire: 'cue.sunscar.whip.crack', heavy: 'cue.sunscar.whip.double', impact: 'cue.sunscar.whip.hit', reload: 'cue.reload' } as const;
export function installSunscarCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  const voices = sharedWeaponVoices(audio);
  cues.use((id, opts) => {
    switch (id) {
      case CUES.fire: voices.swordSwing(); return true;
      case CUES.heavy: voices.swordHeavy(); return true;
      case CUES.impact: voices.swordHit('flesh', opts.pan, opts.gain); return true;
      case CUES.reload: voices.reload(); return true;
      case 'cue.swap': voices.weaponSwap(); return true;
      default: return false;
    }
  }, scope);
}
