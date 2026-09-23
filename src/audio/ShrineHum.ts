// src/audio/ShrineHum.ts — the Driftwood ring shrine hums (docs/plans/MUSIC.md v3 row 9; ASKS D42: "always, by proximity").
//
//   const hum = new ShrineHum(audio, music, { x, y, z });   // main.ts, when the shard has a shrine
//   game.onUpdate(() => hum.update(game.camera));            // per frame: a distance check; the listener only moves when in range
//
// A PannerNode at the shrine (equal-power panning: HRTF's per-source convolution costs the phone tier far more for a drone
// nobody localises to the degree), linear rolloff from 4 m to 22 m, so it is audible inside ~20 m and gone past it. Its source
// is sfx.json's `hums.shrine` loop when one decoded, else a synth drone: a low D (D2 + a quiet D3 so a phone speaker carries it)
// with a soft fifth (A2) breathing on a slow LFO. The nodes exist only while the player is inside BUILD_R (built on the way in,
// stopped on the way out), so the rest of the island pays nothing. Inside 10 m the whole music bus ducks −3 dB (music.duck).
// The WebAudio listener follows the camera: position + forward + up from its world matrix, no allocation per frame.
import type { Camera } from 'three';
import type { Audio } from './Audio';
import type { Music } from './Music';

const REF = 4, MAX = 22, BUILD_R = 30, DROP_R = 36;
const DUCK_IN = 10, DUCK_EDGE = 13, DUCK = 10 ** (-3 / 20);
const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);


export class ShrineHum {
  private nodes: { panner: PannerNode; out: GainNode; srcs: AudioScheduledSourceNode[]; buf: AudioBuffer | undefined } | undefined;
  /** diagnostics: the distance at the last update and whether the hum is built */
  dist = Infinity;

  constructor(private readonly audio: Audio, private readonly music: Music, private readonly pos: { x: number; y: number; z: number }) {}

  get active(): boolean { return this.nodes !== undefined; }
  get source(): 'sample' | 'synth' | undefined { return this.nodes ? (this.nodes.buf ? 'sample' : 'synth') : undefined; }

  update(camera: Camera): void {
    if (!this.audio.ready) return; // never the one to create the AudioContext
    const m = camera.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const dx = px - this.pos.x, dy = py - this.pos.y, dz = pz - this.pos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.dist = d;
    // the duck: −3 dB inside 10 m, eased in over the 3 m before it
    this.music.duck(d <= DUCK_IN ? DUCK : d >= DUCK_EDGE ? 1 : 1 + (DUCK - 1) * ((DUCK_EDGE - d) / (DUCK_EDGE - DUCK_IN)));
    if (d > DROP_R) { if (this.nodes) this.teardown(); return; }
    if (!this.nodes) { if (d > BUILD_R) return; this.build(); }
    else if (this.audio.loop('shrine')?.buffer !== this.nodes.buf) { this.teardown(); this.build(); } // a sample arrived, or the sfx set changed: swap
    // the listener: camera position, forward (−Z column) and up (Y column)
    const l = this.audio.ctx.listener;
    const fx = -m[8], fy = -m[9], fz = -m[10], ux = m[4], uy = m[5], uz = m[6];
    // `.value` writes, not setValueAtTime: no automation event per frame piling up on nine params
    // (the listener's AudioParams: Safari 14.1+, and the game needs iOS 17)
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;
  }

  private build(): void {
    const c = this.audio.ctx, t = c.currentTime;
    const panner = c.createPanner();
    panner.panningModel = 'equalpower'; panner.distanceModel = 'linear';
    panner.refDistance = REF; panner.maxDistance = MAX; panner.rolloffFactor = 1;
    panner.positionX.value = this.pos.x; panner.positionY.value = this.pos.y; panner.positionZ.value = this.pos.z;
    const out = c.createGain(); out.gain.setValueAtTime(0, t);
    out.connect(panner).connect(this.audio.ambient);
    const srcs: AudioScheduledSourceNode[] = [];
    const sample = this.audio.loop('shrine');
    let level = 0.5;
    if (sample) {
      const s = c.createBufferSource(); s.buffer = sample.buffer; s.loop = true; s.loopStart = sample.loopStart; s.loopEnd = sample.loopEnd;
      s.connect(out); s.start(t, sample.loopStart); srcs.push(s); level = sample.gain;
    } else {
      // the synth drone: D2 sine + D3 sine (quiet) + A2 triangle through a 480 Hz low-pass, the fifth breathing on a 0.09 Hz LFO
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.6; lp.connect(out);
      const voice = (type: OscillatorType, n: number, gain: number, detune = 0): GainNode => {
        const o = c.createOscillator(); o.type = type; o.frequency.value = midiHz(n); o.detune.value = detune;
        const g = c.createGain(); g.gain.value = gain; o.connect(g).connect(lp); o.start(t); srcs.push(o); return g;
      };
      voice('sine', 38, 0.55); voice('sine', 50, 0.16, 4);
      const fifth = voice('triangle', 45, 0.14, -3);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.09; const lg = c.createGain(); lg.gain.value = 0.1;
      lfo.connect(lg).connect(fifth.gain); lfo.start(t); srcs.push(lfo);
    }
    out.gain.linearRampToValueAtTime(level, t + 1.5);
    this.nodes = { panner, out, srcs, buf: sample?.buffer };
  }

  private teardown(): void {
    const n = this.nodes; if (!n) return;
    this.nodes = undefined;
    const t = this.audio.ctx.currentTime;
    n.out.gain.cancelScheduledValues(t); n.out.gain.setValueAtTime(n.out.gain.value, t); n.out.gain.linearRampToValueAtTime(0, t + 0.4);
    for (const s of n.srcs) s.stop(t + 0.45);
    window.setTimeout(() => { try { n.panner.disconnect(); } catch { /* gone */ } }, 600);
  }
}
