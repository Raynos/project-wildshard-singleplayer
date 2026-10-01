import type { Audio, CombatCues, Scope } from '#engine';
import { sharedWeaponVoices } from '#kit';

export const CUES = { fire: 'cue.fan.swing', impact: 'cue.fan.hit', heavy: 'cue.fan.heavy', reload: 'cue.reload' } as const;
/** The fan's cues use the kit's blade voices until Sky Reach has its own generated set; GUST is the heavy whoosh. */
export function installSkyCues(audio: Audio, cues: CombatCues, scope: Scope): void {
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
