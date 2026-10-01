import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

/** The fan's cues. No generated SFX yet: every cue plays a kit voice (SWING = a sword swing, GUST = the heavy whoosh). */
export const CUES = { fire: 'cue.sword.swing', impact: 'cue.sword.hit', heavy: 'cue.sword.heavy', reload: 'cue.reload' } as const;
export function installSkyCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  const voices = sharedWeaponVoices(audio);
  cues.use((id, opts) => {
    switch (id) {
      case CUES.fire: voices.swordSwing(); return true;
      case CUES.heavy: voices.swordHeavy(); return true;
      case CUES.impact: voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); return true;
      case 'cue.swap': voices.weaponSwap(); return true;
      default: return false;
    }
  }, scope);
}
