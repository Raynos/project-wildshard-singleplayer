import { synthKit } from '@wildshard/engine/audio/gen';

/**
 * Creature voices, synthesised (moved from the engine's generator, E405 LAYER-PURITY): reusable content any level can
 * give its creatures, built on the engine's primitives (`synthKit`).
 *
 *   vocal(kind, sr, seed)    'boar' grunt · 'crab' clack · 'monkey' screech · 'sailor' the drowned moan
 *   windup(kind, sr, seed)   'boar' hoof scrape · 'crab' claw raise · 'sailor' lantern flare
 */
const { Rand, Biquad, len, saturate, noise, thump, grains, strike, click, bubbles, voice, ahr, lerp, lerpV, finish } = synthKit;

export type CreatureVoice = 'boar' | 'crab' | 'monkey' | 'sailor';
export type CreatureWindup = 'boar' | 'crab' | 'sailor';
export const CREATURE_VOICES: readonly CreatureVoice[] = ['boar', 'crab', 'monkey', 'sailor'];

/** a creature's voice: its aggro / hurt bark */
export function vocal(e: CreatureVoice, sr: number, seed: number): Float32Array {
  const r = new Rand(seed * 2654435 + 5);
  switch (e) {
    case 'boar': { // two or three nasal grunts: a rough, low pulse through pig-snout formants, a snort on the first
      const n = 2 + Math.floor(r.next() * 2), out = new Float32Array(len(0.14 + n * 0.22, sr));
      noise(out, 0, sr, r, { type: 'bandpass', f: 1800, q: 1.4, attack: 0.01, decay: 0.05, gain: 0.25 });
      let at = len(0.02, sr);
      for (let k = 0; k < n; k++) {
        const d = r.range(0.11, 0.16), f0a = r.range(88, 110), f0b = r.range(62, 72);
        const snout: [number, number, number][] = [[r.range(330, 400), 5, 1], [950, 6, 0.6], [2300, 7, 0.22]];
        voice(out, at, sr, r, {
          dur: d + 0.06, f0: (u) => lerp(f0a, f0b, u), tense: () => 0.85, breath: () => 0.12, rough: 0.55, jitter: 0.04, shimmer: 0.15,
          vowel: () => snout, env: ahr(0.012, d * 0.6, 0.04), gain: 1.6,
        });
        at += len(d + r.range(0.05, 0.09), sr);
      }
      return finish(saturate(out, 1.4), sr);
    }
    case 'crab': { // the claws clacking: a burst of hard chitin clicks that speeds up, a fizz of froth under it
      const n = 4 + Math.floor(r.next() * 4), out = new Float32Array(len(0.45, sr));
      let at = 0, gap = r.range(0.06, 0.08);
      for (let k = 0; k < n; k++) {
        click(out, at, sr, r, 3000, 0.5, 0.001);
        strike(out, at, sr, r, [[r.range(2100, 2400), 0.02, 1], [3300, 0.016, 0.7], [4800, 0.012, 0.5]], 0.3, 0.1);
        at += len(gap, sr); gap *= 0.82;
      }
      noise(out, 0, sr, r, { type: 'bandpass', f: 4200, q: 1.2, attack: 0.05, decay: 0.12, gain: 0.05 });
      bubbles(out, len(0.03, sr), sr, r, 8, 0.3, 2500, 5000, 0.04);
      return finish(out, sr);
    }
    case 'monkey': { // a screech: two rising "ee" bursts, harsh and wobbling
      const out = new Float32Array(len(0.7, sr));
      for (let k = 0; k < 2; k++) {
        const d = k === 0 ? r.range(0.18, 0.24) : r.range(0.26, 0.34), top = r.range(1300, 1650);
        voice(out, len(k * 0.27, sr), sr, r, {
          dur: d + 0.08, f0: (u) => (u < 0.35 ? lerp(top * 0.5, top, u / 0.35) : lerp(top, top * 0.72, (u - 0.35) / 0.65)) + Math.sin(u * d * 2 * Math.PI * 24) * 70,
          tense: () => 0.95, breath: () => 0.28, rough: 0.25, jitter: 0.03, shimmer: 0.12,
          vowel: () => [[1150, 4, 1], [2500, 5, 0.7], [3700, 6, 0.35]], env: ahr(0.015, d * 0.55, 0.05), gain: 1.3,
        });
      }
      noise(out, 0, sr, r, { type: 'bandpass', f: 3200, q: 1.2, attack: 0.02, decay: 0.15, gain: 0.08 });
      return finish(saturate(out, 1.3), sr);
    }
    case 'sailor': { // the drowned moan: a long low "oo-aah-oo" with a ghost double, gurgling through water
      const dur = r.range(1.2, 1.45), out = new Float32Array(len(dur + 0.2, sr));
      const oo: [number, number, number][] = [[320, 5, 1], [800, 6, 0.45], [2400, 8, 0.1]], aa: [number, number, number][] = [[620, 5, 1], [1050, 6, 0.6], [2500, 8, 0.15]];
      const vowel = (u: number) => lerpV(oo, aa, Math.sin(Math.min(1, u * 1.3) * Math.PI));
      const f0a = r.range(92, 102);
      for (const [det, g] of [[1, 1], [1.031, 0.45]] as const) {
        voice(out, 0, sr, r, {
          dur, f0: (u) => f0a * det * lerp(1, 0.74, u) * (1 + 0.012 * Math.sin(u * dur * 2 * Math.PI * 5.5)), tense: (u) => lerp(0.45, 0.25, u), breath: () => 0.22,
          rough: 0.3, jitter: 0.045, shimmer: 0.18, vowel, env: ahr(0.18, dur * 0.45, dur * 0.2), gain: 1.4 * g,
        });
      }
      // the gurgle: the voice chopped by a slow random flutter, bubbles rising through it
      const fl = new Biquad('lowpass', 14, 0.7, sr);
      for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) * (0.65 + 0.35 * Math.tanh(fl.run(r.bi()) * 12));
      bubbles(out, len(0.15, sr), sr, r, 16, dur * 0.8, 250, 900, 0.1);
      new Biquad('lowpass', 3000, 0.7, sr).apply(out);
      return finish(out, sr, 0.9, 0.12);
    }
    default: break; // every CreatureVoice has a case above
  }
  throw new Error(`vocal: ${String(e)}`);
}

/** a creature's telegraph, 400–700 ms before its attack lands */
export function windup(e: CreatureWindup, sr: number, seed: number): Float32Array {
  const r = new Rand(seed * 31337 + 7);
  switch (e) {
    case 'boar': { // two hoof scrapes in the dirt, then an angry snort
      const out = new Float32Array(len(0.85, sr));
      for (const t of [0, r.range(0.28, 0.34)]) {
        const at = len(t, sr);
        thump(out, at, sr, 95, 55, 0.04, 0.5);
        noise(out, at, sr, r, { type: 'bandpass', f: 1600, f1: 850, q: 0.8, attack: 0.04, decay: 0.07, gain: 0.35 });
        grains(out, at, sr, r, { rate: 900, dur: 0.16, f: 2200, q: 0.9, gain: 0.4, shape: 1 });
        noise(out, at + len(0.03, sr), sr, r, { type: 'highpass', f: 3200, attack: 0.02, decay: 0.06, gain: 0.12 });
      }
      noise(out, len(0.62, sr), sr, r, { type: 'bandpass', f: 1500, f1: 900, q: 1.6, attack: 0.012, decay: 0.07, gain: 0.45 });
      return finish(out, sr);
    }
    case 'crab': { // the claw rising: a chitin creak (an accelerating train of tiny clicks), then the claw snapping open
      const out = new Float32Array(len(0.55, sr));
      let t = 0, gap = 0.03;
      for (let k = 0; k < 16 && t < 0.4; k++) {
        strike(out, len(t, sr), sr, r, [[r.range(2500, 4000), 0.008, 1], [r.range(1200, 1600), 0.01, 0.5]], 0.15 + k * 0.01, 0.05);
        t += gap; gap = Math.max(0.009, gap * 0.86);
      }
      const at = len(t + 0.02, sr);
      click(out, at, sr, r, 3500, 0.7, 0.0015);
      strike(out, at, sr, r, [[2200, 0.025, 1], [3300, 0.02, 0.7], [700, 0.04, 0.4]], 0.4);
      return finish(out, sr);
    }
    case 'sailor': { // the lantern flaring: a whoomph of flame, crackle, and an eerie low chord swelling under it
      const out = new Float32Array(len(1.0, sr));
      noise(out, 0, sr, r, { type: 'lowpass', f: 150, f1: 1600, q: 1.2, attack: 0.12, decay: 0.18, gain: 1.0, pink: true });
      grains(out, len(0.05, sr), sr, r, { rate: 70, dur: 0.85, f: 3000, q: 0.8, gain: 0.5, grain: 0.0012, shape: 1 });
      const n = out.length;
      for (const [f, g] of [[110, 0.12], [164.8, 0.08], [220.6, 0.05], [109.2, 0.08]] as const) {
        let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / sr; ph += (2 * Math.PI * f) / sr; out[i] = (out[i] ?? 0) + Math.sin(ph) * g * Math.min(1, t / 0.3) * Math.exp(-Math.max(0, t - 0.35) / 0.35); }
      }
      return finish(out, sr, 0.9, 0.08);
    }
    default: break; // every CreatureWindup has a case above
  }
  throw new Error(`windup: ${String(e)}`);
}
