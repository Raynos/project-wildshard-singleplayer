import { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { audioRandom } from '@wildshard/engine/audio/util';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import { FOREST_AUDIO } from './profile';

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);

/** Pine's original fallback wind bands, gusts and FM birds, on the generic mixer blocks. */
export class ForestVoices {
  private windGain: GainNode | undefined;
  private windGain2: GainNode | undefined;
  private bedScope: Scope | undefined;
  constructor(private readonly a: Audio) {}
  private timers(): Scope { this.bedScope ??= new Scope('audio.pine.bed'); return this.bedScope; }
  stop(): void { this.bedScope?.dispose(); this.bedScope = undefined; this.windGain = this.windGain2 = undefined; }

  /** the pines: the original three wind bands, the tree hiss, gusts and distant birds */
  start(): void {
    tap.sound?.('audio.startForest');
    this.windGain = this.a.mkWind(260, 0.5, -0.55, 0.07, 0.11);
    this.windGain2 = this.a.mkWind(620, 0.8, 0.55, 0.11, 0.06);
    this.a.mkWind(140, 0.4, 0.0, 0.05, 0.09);
    // tree hiss (very quiet high band)
    this.a.mkWind(2400, 0.5, 0.2, 0.09, 0.012);
    this.scheduleGust();
    this.scheduleBird();
  }

  private scheduleGust(gentle = 1): void {
    const wait = rnd(5, 12) * gentle;
    this.timers().timeout(wait * 1000, () => {
      ambientTick('audio.gust', () => {
        if (this.a.ambientOn && this.windGain && this.windGain2) {
          const t = this.a.ctx.currentTime, rise = rnd(1.5, 3), fall = rnd(2, 4), amt = 1 + rnd(0.5, 1.6) / gentle;
          for (const g of [this.windGain, this.windGain2]) {
            const base = (g === this.windGain ? 0.11 : 0.06);
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(base * amt, t + rise);
            g.gain.linearRampToValueAtTime(base, t + rise + fall);
          }
        }
        this.scheduleGust(gentle);
      });
    });
  }

  private scheduleBird() {
    const wait = rnd(4, 12);
    this.timers().timeout(wait * 1000, () => {
      ambientTick('audio.bird', () => {
        if (this.a.ambientOn) this.birdsong();
        this.scheduleBird();
      });
    });
  }

  /** a short distant phrase of 2–5 FM chirps, random pan */
  private birdsong() {
    const c = this.a.ctx, t0 = c.currentTime;
    const pan = rnd(-0.9, 0.9), dist = rnd(0.35, 1), base = rnd(2400, 4200);
    const notes = 2 + Math.floor(rnd(0, 4));
    const bus = c.createGain(); bus.gain.value = 0.11 * dist;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000 * dist;
    bus.connect(lp); this.a.route(lp, pan, this.a.ambient);
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const f0 = base * rnd(0.85, 1.2), f1 = f0 * rnd(0.7, 1.4), dur = rnd(0.05, 0.13);
      this.a.tone({ t, type: 'sine', f0, f1, glide: dur, gain: 1, attack: 0.012, decay: dur, vibrato: { rate: rnd(30, 60), depth: rnd(80, 260) }, out: bus });
      t += dur + rnd(0.03, 0.12);
    }
  }

}

export function installForestVoices(audio: Audio, scope: Scope): ForestVoices {
  const voices = new ForestVoices(audio);
  audio.installSynthBed(FOREST_AUDIO.bed, voices, scope);
  return voices;
}
