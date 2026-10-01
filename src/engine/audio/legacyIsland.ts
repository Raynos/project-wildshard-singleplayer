import { Scope } from '../app/scope';
import { PlayerVoices } from './playerVoices';
import { audioRandom, panFromYaw } from './util';
import { tap, ambientTick } from '../core/harnessTap';
import type { Vector3 } from 'three';

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);

/** S4.3 parking: the existing ocean calls and surf keep their authored taps and envelopes. */
export abstract class LegacyIsland extends PlayerVoices {
  abstract listenerYaw: number;
  protected abstract ambientOn: boolean;
  protected abstract windGain: GainNode | undefined;
  protected abstract windGain2: GainNode | undefined;
  protected abstract mkWind(freq: number, q: number, pan: number, lfoRate: number, base: number, lowpass?: number): GainNode;
  protected abstract scheduleGust(gentle?: number): void;
  private surfScope: Scope | undefined;
  protected stopIsland(): void { this.surfScope?.dispose(); this.surfScope = undefined; }
  gullCall(pan = 0, gain = 1): void {
    tap.sound?.('gullCall');
    if (!this.ready || this.shot('gull', { pan, gain, out: this.ambient })) return;
    const c = this.ctx, t = c.currentTime;
    const bus = c.createGain(); bus.gain.value = 0.28 * gain;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    bus.connect(bp); this.route(bp, pan, this.ambient);
    const base = rnd(1050, 1350);
    // note 1: rises fast then bends down, wide fast vibrato (the rasp)
    this.tone({ t, type: 'sawtooth', f0: base * 0.85, f1: base * 1.25, glide: 0.06, gain: 1, attack: 0.015, hold: 0.05, decay: 0.09, vibrato: { rate: 42, depth: 90 }, lowpass: 4200, out: bus });
    this.tone({ t: t + 0.06, type: 'sawtooth', f0: base * 1.25, f1: base * 0.9, glide: 0.12, gain: 0.7, attack: 0.005, decay: 0.12, vibrato: { rate: 42, depth: 90 }, lowpass: 3600, out: bus });
    this.burst({ t, type: 'bandpass', freq: base * 2, q: 2, gain: 0.25, attack: 0.02, hold: 0.06, decay: 0.1, out: bus });
    // note 2: lower, shorter
    const t2 = t + rnd(0.2, 0.27);
    this.tone({ t: t2, type: 'sawtooth', f0: base * 0.95, f1: base * 0.62, glide: 0.16, gain: 0.8, attack: 0.012, hold: 0.03, decay: 0.15, vibrato: { rate: 36, depth: 70 }, lowpass: 3200, out: bus });
    this.burst({ t: t2, type: 'bandpass', freq: base * 1.6, q: 2, gain: 0.18, attack: 0.02, decay: 0.12, out: bus });
    if (audioRandom() < 0.35) {
      const t3 = t2 + rnd(0.2, 0.28);
      this.tone({ t: t3, type: 'sawtooth', f0: base * 0.8, f1: base * 0.55, glide: 0.14, gain: 0.55, attack: 0.012, decay: 0.14, vibrato: { rate: 30, depth: 60 }, lowpass: 2800, out: bus });
    }
  }

  /** gullCall positioned like `animal()`: distance attenuation + a stereo pan from the listener yaw */
  gullCallAt(position: Vector3, listenerPos: Vector3, yaw = this.listenerYaw): void {
    tap.sound?.('gullCallAt');
    if (!this.ready) return;
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 160) return;
    const att = 1 / (1 + dist / 14) ** 1.3;
    const pan = panFromYaw(dx, dz, yaw, 0.8, dist);
    this.gullCall(pan, att);
  }

  protected startIsland(): void {
    this.surfScope = new Scope('audio.ocean.surf');
    tap.sound?.('audio.startIsland');
    this.windGain = this.mkWind(180, 0.4, -0.3, 0.05, 0.05, 900);   // a lighter, warmer breeze than the pines
    this.windGain2 = this.mkWind(420, 0.6, 0.3, 0.08, 0.03, 1100);
    this.mkWind(1500, 0.35, 0.0, 0.03, 0.02, 5000);                  // the constant far surf hiss
    this.scheduleGust(1.4);
    this.scheduleSurf();
  }

  private scheduleSurf() {
    const wait = rnd(6, 9);
    this.surfScope?.timeout(wait * 1000, () => {
      ambientTick('audio.surf', () => {
        if (this.ambientOn) this.surfSwell();
        this.scheduleSurf();
      });
    });
  }

  /** one wave: a low rumble building over ~2 s, the break (a wide bright hiss), then the wash sliding back down the sand */
  private surfSwell() {
    const c = this.ctx, t = c.currentTime;
    const pan = rnd(-0.35, 0.35), size = rnd(0.7, 1.15);
    const bus = c.createGain(); bus.gain.value = 0.42 * size;
    this.route(bus, pan, this.ambient);
    const build = rnd(1.6, 2.4), wash = rnd(2.6, 4.0);
    // the build: low noise rising in pitch and level
    this.burst({ t, type: 'lowpass', freq: 240, freqEnd: 700, gain: 0.5, attack: build, decay: 1.2, hold: 0.2, out: bus });
    // the break: wide, bright, a fast swell then the long wash tail that darkens as it drains
    this.burst({ t: t + build * 0.75, type: 'bandpass', freq: 1800, freqEnd: 500, q: 0.4, gain: 0.55, attack: 0.5, hold: 0.4, decay: wash, out: bus });
    this.burst({ t: t + build * 0.85, type: 'highpass', freq: 2600, gain: 0.16, attack: 0.35, hold: 0.3, decay: wash * 0.6, out: bus });
    // the foam fizz on the sand at the end
    this.burst({ t: t + build + 1.2, type: 'bandpass', freq: 4200, q: 0.6, gain: 0.08, attack: 0.6, decay: wash * 0.7, out: bus });
  }
}
