import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { audioRandom, WindGustBed } from '@wildshard/engine/audio/util';
import { ambientTick } from '@wildshard/engine/core/harnessTap';
import { FOREST_AUDIO, FOREST_WIND_BED } from './profile';

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);

/** Pine's original fallback wind bands, gusts and FM birds, on the generic mixer blocks. */
export class ForestVoices extends WindGustBed {
  constructor(audio:Audio, preset:ConstructorParameters<typeof WindGustBed>[1]=FOREST_WIND_BED) { super(audio,preset); }
  override start():void { super.start(); this.scheduleBird(); }

  private scheduleBird() {
    const wait = rnd(4, 12);
    this.queue(wait * 1000, () => {
      ambientTick('audio.bird', () => {
        if (this.audio.ambientOn) this.birdsong();
        this.scheduleBird();
      });
    });
  }

  /** a short distant phrase of 2–5 FM chirps, random pan */
  private birdsong() {
    const c = this.audio.ctx, t0 = c.currentTime;
    const pan = rnd(-0.9, 0.9), dist = rnd(0.35, 1), base = rnd(2400, 4200);
    const notes = 2 + Math.floor(rnd(0, 4));
    const bus = c.createGain(); bus.gain.value = 0.11 * dist;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000 * dist;
    bus.connect(lp); this.audio.route(lp, pan, this.audio.ambient);
    let t = t0;
    for (let i = 0; i < 6; i++) {
      if (i >= notes) break;
      const f0 = base * rnd(0.85, 1.2), f1 = f0 * rnd(0.7, 1.4), dur = rnd(0.05, 0.13);
      this.audio.tone({ t, type: 'sine', f0, f1, glide: dur, gain: 1, attack: 0.012, decay: dur, vibrato: { rate: rnd(30, 60), depth: rnd(80, 260) }, out: bus });
      t += dur + rnd(0.03, 0.12);
    }
  }

}

export function installForestVoices(audio: Audio, scope: Scope, preset:ConstructorParameters<typeof WindGustBed>[1]=FOREST_WIND_BED): ForestVoices {
  const voices = new ForestVoices(audio,preset);
  audio.installSynthBed(FOREST_AUDIO.bed, voices, scope);
  return voices;
}
