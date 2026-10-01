import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

/** The bullwhip's cues. Until the generated crack lands (README, open asks) each one plays a kit voice. */
export const CUES = { fire: 'cue.sunscar.whip.crack', impact: 'cue.sunscar.whip.hit', heavy: 'cue.sunscar.whip.double', reload: 'cue.reload' } as const;
export function installDunesCues(audio: Audio, cues: CombatCues, scope: Scope): void {
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
