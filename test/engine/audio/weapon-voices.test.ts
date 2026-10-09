import { afterEach, describe, expect, it } from 'vitest';
import { Audio } from '../../../src/engine/audio/Audio';
import { bindAudioRandom } from '../../../src/engine/audio/util';
import { Rng } from '../../../src/engine/core/rng';
import { tap } from '../../../src/engine/core/harnessTap';
import { sharedWeaponVoices, type WeaponSynth } from '@wildshard/sdk/runtime/audio/weaponVoices';
import { reload } from '../../../src/game/systems/audio/crossbowSounds';
import { rifleFire } from '../../../src/game/systems/audio/firearmSounds';
import { swordHit } from '../../../src/game/systems/audio/meleeSounds';

afterEach(() => { tap.sound = null; const rng = new Rng(0); bindAudioRandom(() => rng.next()); });
describe('platform equipment synth recipes', () => {
  it('keeps literal taps before the gesture and creates no audio graph', () => {
    const ids: string[] = [], audio = new Audio(), v = sharedWeaponVoices(audio);
    tap.sound = (id) => { ids.push(id); };
    v.crossbowFire(); v.dryFire(); v.boltImpact('wood'); v.reload(); v.rifleFire(); v.rifleReload();
    v.swordSwing(); v.swordHeavy(); v.swordHit('flesh'); v.weaponSwap();
    expect(ids).toEqual(['crossbowFire', 'dryFire', 'boltImpact:wood', 'reload', 'rifleFire', 'rifleReload',
      'swordSwing', 'swordHeavy', 'swordHit:flesh', 'weaponSwap']);
    expect(audio.ready).toBe(false);
  });
  it('keeps rifle random draws interleaved with noise bursts', () => {
    let draws = 0;
    bindAudioRandom(() => { draws++; return 0.25; });
    const trace: [string, number, number, number][] = [];
    const a: WeaponSynth = { ready: true, ctx: { currentTime: 10 }, shot: () => false, cue: () => false,
      burst: (o) => { trace.push(['burst', o.t ?? 10, o.freq, draws]); draws++; },
      tone: (o) => { trace.push(['tone', o.t ?? 10, o.f0, draws]); } };
    rifleFire(a);
    expect(trace).toEqual([
      ['burst', 10, 3800, 0], ['burst', 10.002, 1500, 1], ['tone', 10.001, 150, 2],
      ['burst', 10.055, 2200, 2], ['tone', 10.1175, 5500, 5], ['burst', 10.04, 900, 6],
    ]);
    expect(draws).toBe(7);
  });
  it('samples before any synth or reload randomness, and checks authored melee cues first', () => {
    let draws = 0, samples = 0, blocks = 0;
    bindAudioRandom(() => { draws++; return 0.5; });
    const a: WeaponSynth = { ready: true, ctx: { currentTime: 0 }, shot: () => { samples++; return true; }, cue: () => false,
      burst: () => { blocks++; }, tone: () => { blocks++; } };
    reload(a); swordHit(a, 'wood');
    expect({ draws, samples, blocks }).toEqual({ draws: 0, samples: 2, blocks: 0 });
    a.cue = () => true;
    swordHit(a, 'flesh');
    expect(samples).toBe(2);
  });
});
