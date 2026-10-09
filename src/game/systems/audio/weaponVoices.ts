import type { Audio } from '@wildshard/engine/audio/Audio';
import type { CombatCueOpts } from '@wildshard/engine/combat/cues';
import { crossbowFire, dryFire, boltImpact, reload } from './crossbowSounds';
import { rifleFire, rifleReload } from './firearmSounds';
import { swordSwing, swordHeavy, swordHit } from './meleeSounds';

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
