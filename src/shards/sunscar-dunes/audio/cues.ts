import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

/** The bullwhip's cues. Until the locally generated crack lands (MOSS + Stable Audio), they play kit voices. */
export const CUES = { fire: 'cue.whip.crack', heavy: 'cue.whip.double', impact: 'cue.whip.hit', reload: 'cue.reload' } as const;
export function installDuneCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  const voices = sharedWeaponVoices(audio);
  cues.use((id, opts) => {
    switch (id) {
      case CUES.fire: voices.swordSwing(); return true;
      case CUES.heavy: voices.swordHeavy(); return true;
      case CUES.impact: voices.swordHit('flesh', opts.pan, opts.gain); return true;
      case 'cue.swap': voices.weaponSwap(); return true;
      default: return false;
    }
  }, scope);
}
