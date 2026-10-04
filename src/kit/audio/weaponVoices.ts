import type { Audio } from '@wildshard/engine/audio/Audio';
import { crossbowFire, dryFire, boltImpact, reload } from '../weapons/crossbow/sounds';
import { rifleFire, rifleReload } from '../weapons/firearm/sounds';
import { swordSwing, swordHeavy, swordHit } from '../weapons/melee/sounds';

/** Only the oscillator blocks and sample/cue ports that an equipment recipe reads. */
export interface WeaponSynth {
  readonly ready: boolean; readonly ctx: Pick<AudioContext, 'currentTime'>;
  shot: Audio['shot']; cue: Audio['cue'];
  burst: (opts: Parameters<Audio['burst']>[0]) => void;
  tone: (opts: Parameters<Audio['tone']>[0]) => void;
}

/** The kit's default equipment voices; samples and synth blocks come from the level's mixer. */
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
