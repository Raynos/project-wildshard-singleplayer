import { PlayerVoices } from './playerVoices';
import { audioRandom, panFromYaw } from './util';
import { tap } from '../core/harnessTap';
import type { Vector3 } from 'three';

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);

/** S4.3 parking: the ocean gull calls, until the level's own voice table plays them (08 §6.3 C.2). */
export abstract class LegacyIsland extends PlayerVoices {
  abstract listenerYaw: number;
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
}
