import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { crossbowFire, dryFire, boltImpact, reload } from "../systems/audio/crossbowSounds";
import { rifleFire, rifleReload } from "../systems/audio/firearmSounds";
import { swordSwing, swordHeavy, swordHit } from "../systems/audio/meleeSounds";


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


/** Only the oscillator blocks and sample/cue ports that an equipment recipe reads. */
export interface WeaponSynth {
  readonly ready: boolean; readonly ctx: Pick<AudioContext, 'currentTime'>;
  shot: Audio['shot']; cue: Audio['cue'];
  burst: (opts: Parameters<Audio['burst']>[0]) => void;
  tone: (opts: Parameters<Audio['tone']>[0]) => void;
}

/** The platform's default equipment voices; samples and synth blocks come from the level's mixer. */
export function sharedWeaponVoices(audio: Audio): {
  crossbowFire: () => void; dryFire: () => void; reload: () => void; rifleFire: () => void; rifleReload: () => void;
  swordSwing: () => void; swordHeavy: () => void; weaponSwap: () => void;
  boltImpact: (kind: 'wood' | 'ground' | 'flesh', pan?: number, gain?: number) => void;
  swordHit: (kind?: 'wood' | 'ground' | 'flesh', pan?: number, gain?: number) => void;
} {
  return {
    crossbowFire: () => { crossbowFire(audio); }, dryFire: () => { dryFire(audio); }, reload: () => { reload(audio); },
    rifleFire: () => { rifleFire(audio); }, rifleReload: () => { rifleReload(audio); },
    swordSwing: () => { swordSwing(audio); }, swordHeavy: () => { swordHeavy(audio); },
    boltImpact: (kind, pan, gain) => { boltImpact(audio, kind, pan, gain); },
    swordHit: (kind, pan, gain) => { swordHit(audio, kind, pan, gain); },
    weaponSwap: () => { audio.weaponSwap(); },
  };
}

/** Catalogue voices for declared audio; reuse the existing sampled/synth recipes and impact surface routing. */
export function declaredWeaponVoices(audio: Audio): ReadonlyMap<string, (opts: CombatCueOpts) => void> {
  const voices = sharedWeaponVoices(audio);
  return new Map<string, (opts: CombatCueOpts) => void>([
    ['sword.swing', () => { voices.swordSwing(); }], ['sword.heavy', () => { voices.swordHeavy(); }],
    ['sword.hit', (opts) => { voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); }],
    ['weapon.reload', () => { voices.reload(); }], ['weapon.swap', () => { voices.weaponSwap(); }],
  ]);
}
