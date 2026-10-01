import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

export const CUES = { fire: 'cue.sword.swing', impact: 'cue.sword.hit', heavy: 'cue.sword.heavy', reload: 'cue.reload' } as const;
/** Every authored equipment cue delegates to a kit sound, retaining its sampled/synth fallback. */
export function installTemplateCues(audio: Audio, cues: CombatCues, scope: Scope): void {
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
