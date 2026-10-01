import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

export const CUES = { fire: 'cue.whip.crack', impact: 'cue.whip.hit', heavy: 'cue.whip.heavy', reload: 'cue.reload' } as const;
/** The whip's cues on kit voices until its own crack is generated (MOSS + Stable Audio, the better take). */
export function installSunscarCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  const voices = sharedWeaponVoices(audio);
  cues.use((id, opts) => {
    switch (id) {
      case CUES.fire: voices.swordSwing(); return true;
      case CUES.heavy: voices.swordHeavy(); return true;
      case CUES.impact: voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); return true;
      case CUES.reload: voices.reload(); return true;
      case 'cue.swap': voices.weaponSwap(); return true;
      default: return false;
    }
  }, scope);
}
