import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';

/** Sound operations supplied by the owning mixer; the router allocates no audio resources. */
export interface CombatAudio {
  rifleFire: () => void; crossbowFire: () => void; swordSwing: () => void; swordHeavy: () => void;
  swordHit: (surface: 'wood' | 'ground' | 'flesh', pan: number, gain: number) => void;
  boltImpact: (surface: 'wood' | 'ground' | 'flesh', pan: number, gain: number) => void;
  dryFire: () => void; rifleReload: () => void; reload: () => void; weaponSwap: () => void;
}
const surfaceOf = (opts: CombatCueOpts): 'wood' | 'ground' | 'flesh' => opts.surface === 'wood' || opts.surface === 'flesh' ? opts.surface : 'ground';
/** Shared synth fallback retains the methods which own today's literal sound tap ids. */
export function sharedCombatCues(audio: CombatAudio, meleeSilent: boolean): CombatCueMap {
  return (id, opts) => {
    switch (id) {
      case 'cue.firearm.fire': case 'cue.lever.fire': audio.rifleFire(); return true;
      case 'cue.crossbow.fire': case 'cue.longbow.loose': case 'cue.bow.loose': audio.crossbowFire(); return true;
      case 'cue.sabre.swing': case 'cue.spear.thrust': case 'cue.sword.swing': case 'cue.jian.swing':
        if (!meleeSilent) audio.swordSwing(); return true;
      case 'cue.sword.heavy': case 'cue.jian.heavy': if (!meleeSilent) audio.swordHeavy(); return true;
      case 'cue.sword.hit': case 'cue.sabre.hit': case 'cue.jian.hit':
        if (!meleeSilent) audio.swordHit(surfaceOf(opts), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.javelin.hit': case 'cue.arrow.hit': case 'cue.projectile.hit': audio.boltImpact(surfaceOf(opts), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.firearm.reload': case 'cue.lever.reload': audio.rifleReload(); return true;
      case 'cue.reload': audio.reload(); return true;
      case 'cue.dry': case 'cue.lever.dry': audio.dryFire(); return true;
      case 'cue.swap': audio.weaponSwap(); return true;
      default: return false;
    }
  };
}
