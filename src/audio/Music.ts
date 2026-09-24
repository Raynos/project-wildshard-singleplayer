// src/audio/Music.ts — the Wildshard score, played by a small WebAudio instrument set (project/archive/2026-09-23-music.md).
//
//   const music = new Music(audio);                 // its own `music` gain → audio.master; shares the AudioContext
//   music.play('theme');                            // on ENTER (after audio.resume()); loops D → B for as long as it plays
//   music.setState({ shard: 'pine' | 'island', mode: 'menu' | 'calm' | 'alert' | 'combat', intensity: 0..1, underwater: false });
//   music.sting('pickup' | 'death' | 'chunk');      // the bell motif · the minor turn then 6 s of silence · the resolve chord
//   music.stop();                                   // fades the bus over a bar and silences every voice
//   music.volume = 0.7;                             // persisted as Settings 'music' (the pause menu's MUSIC slider drives it)
//   await music.renderOffline('trailer30', 28.2);   // the same graph on an OfflineAudioContext (48 kHz stereo) → AudioBuffer
//
// Instruments (7 patches, all here): drone (two detuned saws an octave apart through a slow low-pass) · pad (4-voice
// chord, triangle + sine, slow attack) · pluck (Karplus-Strong: a noise burst through a feedback delay line — computed
// into a buffer, because a DelayNode feedback loop bottoms out at one render quantum = 375 Hz at 48 kHz, under the motif)
// · marimba (sine + 4th-harmonic sine, exponential decay) · bass (sine + a little saw, sidechained to the kick) · pulse
// (filtered-noise shaker, a tap, a low sine kick) · bell (2-operator FM).
//
// Sequencer: bars are scheduled 2 bars ahead on the AudioContext clock from a 120 ms timer (no per-frame work, no
// AudioWorklet / ScriptProcessor). Layer levels crossfade over one bar starting on a bar; tempo and the Lydian → Dorian
// switch change on a bar (pending bars are cancelled and rescheduled when the state changes). Under water the whole
// music bus runs through a 600 Hz low-pass and a slow chorus. `renderOffline` runs the identical scheduler on an
// OfflineAudioContext — the trailer render and the live playback are one code path.
//
// v3 (project/archive/2026-09-23-music.md rows 7–8): a STEM PLAYER beside the synth (src/audio/Stems.ts). Settings 'musicStyle' picks
// piano / orchestral / folk (MiniMax-Music3 stems in public/assets/music/<style>/) or synth. Every style's files are downloaded
// at the loading bar and the selected style's title + this shard's slot + stings are decoded there (project/archive/2026-09-23-preload-offline.md;
// `useBank`), so play() starts the stems at once; the synth plays for a style / slot the build lacks or that failed to decode.
// Slots: menu → 'title' (main.ts starts the music on the title screen's first gesture), Pine Hollow → 'pine', Driftwood → 'island';
// ENTER WORLD / exit-to-menu crossfade between them over a bar. calm / alert / combat drive the tension stem's gain (0 / 0.5 / 1)
// on the deck's bar grid. Underwater is the same low-pass (the stems run through the engine's bus). A slot or style change
// crossfades over at least a bar; one style is resident at a time (a style switch decodes the new one from the offline cache —
// Cache Storage, never the network — while the old one plays on, then crossfades on a bar and drops the old buffers; the menu
// shows a spinner only past 300 ms, src/audio/preload.ts). `music.duck(k)` scales the whole bus
// (the Driftwood shrine's −3 dB, src/audio/ShrineHum.ts).
//
// Pine Hollow's own slots (PINE-HOLLOW-REMASTER PH-A1, PH-U12): theme 1 ('pine') stays; `music.setPineScene('night' | 'boss' |
// 'day')` switches to calm-night or the Antler King's boss track, `music.setBossPhase(1 | 2 | 3)` moves the boss's layers (I the
// Warden · II Lanterns Fall · III the Last Light) on its bar grid, `music.sting('dawn')` is the quest's reward sting. They live in
// public/assets/music/pine-hollow-<style>/ (not fetched by the loading bar, so the other shards' load is untouched): a slot is
// decoded when it is first wanted (the theme plays on meanwhile) and the other Pine Hollow slot's buffers are dropped
// (~30 MB of PCM each). `prefetchPine()` pulls the selected style's files into the offline cache while the player is in.
// Quick links: `?music=pine-night`, `?music=pine-boss` (`-2` / `-3` for a phase), `?music=pine-dawn` (the sting after 2 s).
import type { Audio } from './Audio';
import { getActiveChunk } from '../chunks/registry';
import { getNumber, setNumber, onNumber, getMusicStyle, onMusicStyle, type MusicStyle } from '../ui/Settings';
import { Deck, decodeStyle, setFiles, type BossPhase, type SlotAudio, type SlotName, type StyleBank } from './Stems';
import { cachedBytes, decodeBytes, trackBusy } from './preload';
import {
  ARRANGEMENTS, CHORDS, CHORD_ROOT, DORIAN_OF, STING_CHUNK, STING_DEATH, STING_PICKUP, dorianPitch,
  type Arrangement, type ArrangementName, type ChordName, type LayerId, type MixKey, type NoteEv, type Segment,
} from './score/wildshard-theme';

export type Shard = 'pine' | 'island';
export type MusicMode = 'menu' | 'calm' | 'alert' | 'combat';
export type StingName = 'pickup' | 'death' | 'chunk' | 'dawn';
/** Pine Hollow's music scene (PINE-HOLLOW-REMASTER PH-A1): 'day' = theme 1 ('pine'), 'night' = calm-night, 'boss' = the Antler King */
export type PineScene = 'day' | 'night' | 'boss';
export type { BossPhase } from './Stems';
export interface MusicState { shard: Shard; mode: MusicMode; intensity: number; underwater: boolean }

const LOOKAHEAD_BARS = 2;
const TICK_MS = 120;
const TEMPO: Record<MusicMode, number> = { menu: 104, calm: 96, alert: 100, combat: 112 };
type GainKey = Exclude<MixKey, 'lpf' | 'chorus'>;
const GAIN_KEYS: GainKey[] = ['drone', 'pad', 'pluck', 'marimba', 'bass', 'pulse', 'pulse.soft', 'pulse.kick', 'pulse.four', 'bell'];
const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

interface Voice { srcs: AudioScheduledSourceNode[]; out: GainNode }
interface PadVoice extends Voice { release: (t: number, secs: number) => void; unrelease: () => void; releaseAt?: number | undefined }
interface Bar {
  segIdx: number; beat0: number; beats: number; t0: number; spb: number;
  voices: Voice[];
  /** the state to restore if this bar is cancelled (the sequencer rewinds to it) */
  before: { pad: PadVoice | undefined; targets: Partial<Record<MixKey, number>>; lastChord: ChordName | undefined };
}

/** the context-agnostic core: instruments + mixer + sequencer. `Music` wraps it for the live game. */
class Engine {
  readonly ctx: BaseAudioContext;
  /** volume → lpf → (dry | chorus) → dest */
  readonly bus: GainNode;
  /** the sequencer's layers sum here; the death sting ducks it while the sting itself bypasses (stingBus) */
  readonly seq: GainNode;
  /** the synth's share of the bus: 1 alone, faded to 0 while the stems play (Music hands over on a bar) */
  readonly synthMix: GainNode;
  readonly stingBus: GainNode;
  readonly lpf: BiquadFilterNode;
  readonly chorusWet: GainNode;
  readonly gains = {} as Record<GainKey, GainNode>;
  private bassDuck: GainNode;
  private noise: AudioBuffer;
  private ks = new Map<number, AudioBuffer>();
  private padFilter: BiquadFilterNode;
  private droneNodes: AudioScheduledSourceNode[] = [];
  private pad: PadVoice | undefined;
  private lastChord: ChordName | undefined;
  private targets: Partial<Record<MixKey, number>> = {};
  private pans = {} as Partial<Record<GainKey, StereoPannerNode>>;
  // sequencer
  arrangement: Arrangement | undefined;
  private segIdx = 0; private beat0 = 0; private nextT = 0;
  private bars: Bar[] = [];
  state: MusicState = { shard: 'pine', mode: 'menu', intensity: 0, underwater: false };
  /** dev: only these layers sound (scripts/music/render.mjs --solo for per-layer level checks) */
  solo: Set<string> | undefined;
  /** diagnostics: scheduled notes / bars, scheduler main-thread time; `liveOsc(now)` counts the oscillators sounding at `now` */
  stats = { notes: 0, bars: 0, schedMs: 0, schedMax: 0 };
  private oscSpans: { t0: number; t1: number }[] = [];
  private spanOf = new WeakMap<AudioScheduledSourceNode, { t0: number; t1: number }>();
  /** an oscillator's stop time moved (a pad released, a bar cancelled): keep the live count honest */
  private restop(o: AudioScheduledSourceNode, t1: number) { const sp = this.spanOf.get(o); if (sp) sp.t1 = t1; }
  liveOsc(now = this.ctx.currentTime): number {
    this.oscSpans = this.oscSpans.filter((o) => o.t1 > now - 1);
    let n = 0; for (const o of this.oscSpans) if (o.t0 <= now && o.t1 > now) n++;
    return n;
  }

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx;
    const c = ctx;
    this.bus = c.createGain(); this.bus.gain.value = 1;
    this.lpf = c.createBiquadFilter(); this.lpf.type = 'lowpass'; this.lpf.frequency.value = 20000; this.lpf.Q.value = 0.4;
    this.bus.connect(this.lpf);
    const dry = c.createGain(); dry.gain.value = 1; this.lpf.connect(dry).connect(dest);
    // the underwater chorus: a 14 ms delay wobbled ±5 ms at 0.35 Hz, mixed in by `chorusWet`
    const delay = c.createDelay(0.1); delay.delayTime.value = 0.014;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.35; const lg = c.createGain(); lg.gain.value = 0.005;
    lfo.connect(lg).connect(delay.delayTime); lfo.start();
    this.chorusWet = c.createGain(); this.chorusWet.gain.value = 0;
    this.lpf.connect(delay).connect(this.chorusWet).connect(dest);
    this.seq = c.createGain(); this.synthMix = c.createGain(); this.seq.connect(this.synthMix).connect(this.bus);
    this.stingBus = c.createGain(); this.stingBus.gain.value = 1; this.stingBus.connect(this.bus);
    // layers
    for (const k of GAIN_KEYS) { const g = c.createGain(); g.gain.value = 0; this.gains[k] = g; this.targets[k] = 0; }
    for (const k of ['drone', 'pad', 'pluck', 'marimba', 'bass', 'pulse', 'bell'] as GainKey[]) this.gains[k].connect(this.seq);
    for (const k of ['pulse.soft', 'pulse.kick', 'pulse.four'] as GainKey[]) this.gains[k].connect(this.gains.pulse);
    this.gains.pulse.gain.value = 1; this.targets.pulse = 1;
    this.padFilter = c.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 2400; this.padFilter.Q.value = 0.5;
    this.padFilter.connect(this.gains.pad);
    this.bassDuck = c.createGain(); this.bassDuck.gain.value = 1;
    const bassLp = c.createBiquadFilter(); bassLp.type = 'lowpass'; bassLp.frequency.value = 420; bassLp.Q.value = 0.8;
    this.bassDuck.connect(bassLp).connect(this.gains.bass);
    for (const [k, p] of [['pluck', -0.22], ['marimba', 0.25], ['bell', 0.08]] as [GainKey, number][]) {
      if (!('createStereoPanner' in c)) continue; // older Safari
      const pan = c.createStereoPanner(); pan.pan.value = p; pan.connect(this.gains[k]); this.pans[k] = pan;
    }
    // 2 s of white noise for the shaker / kick click / Karplus burst
    const len = Math.floor(c.sampleRate * 2);
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); let s = 1234567;
    for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  }

  // ─────────────── helpers ───────────────
  private into(k: GainKey): AudioNode { return this.pans[k] ?? this.gains[k]; }
  private track(o: AudioScheduledSourceNode, t0?: number, t1?: number) {
    if (o instanceof OscillatorNode && t0 !== undefined && t1 !== undefined && this.oscSpans.length < 4096) { const sp = { t0, t1 }; this.oscSpans.push(sp); this.spanOf.set(o, sp); }
  }
  private env(g: AudioParam, t: number, peak: number, attack: number, decay: number, hold = 0) {
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.setValueAtTime(peak, t + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }
  private osc(type: OscillatorType, f: number, t0: number, t1: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.start(t0); o.stop(t1); this.track(o, t0, t1); return o;
  }
  private noiseSrc(t0: number, t1: number, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = rate;
    s.start(t0, (t0 * 7.31) % 1.5); s.stop(t1); return s;
  }

  // ─────────────── the seven patches ───────────────
  /** drone: D2 and D3 saws, the upper one 6 cents flat, through a low-pass that breathes between ~170 and ~400 Hz */
  startDrone(t: number) {
    this.stopDrone();
    const c = this.ctx, far = 1e9;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.9;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045; const lg = c.createGain(); lg.gain.value = 110;
    lfo.connect(lg).connect(lp.frequency); lfo.start(t); lfo.stop(far);
    const a = this.osc('sawtooth', midiHz(38), t, far, 3), b = this.osc('sawtooth', midiHz(50), t, far, -6);
    const ga = c.createGain(); ga.gain.value = 0.09; const gb = c.createGain(); gb.gain.value = 0.062;
    a.connect(ga).connect(lp); b.connect(gb).connect(lp); lp.connect(this.gains.drone);
    this.droneNodes = [a, b, lfo];
  }
  stopDrone() { for (const n of this.droneNodes) { try { n.stop(); } catch { /* not started */ } } this.droneNodes = []; }

  /** pad: 4 voices, the root a sine and the rest triangles, each a few cents off, a slow attack; released when the next chord lands */
  padVoice(chord: ChordName, t: number, attack: number, out: AudioNode = this.padFilter): PadVoice {
    const c = this.ctx, pitches = CHORDS[chord], det = [0, 6, -5, 4], pan = [-0.35, 0.3, -0.15, 0.25];
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + attack);
    g.connect(out);
    const srcs: AudioScheduledSourceNode[] = [];
    pitches.forEach((n, i) => {
      const o = this.osc(i === 0 ? 'sine' : 'triangle', midiHz(n), t, t + 3600, det[i] ?? 0);
      const vg = c.createGain(); vg.gain.value = i === 0 ? 0.24 : 0.155;
      let node: AudioNode = vg;
      if ('createStereoPanner' in c) { const p = c.createStereoPanner(); p.pan.value = pan[i] ?? 0; vg.connect(p); node = p; }
      o.connect(vg); node.connect(g); srcs.push(o);
    });
    const v: PadVoice = {
      srcs, out: g,
      release: (tr, secs) => {
        v.releaseAt = tr;
        g.gain.cancelScheduledValues(tr); g.gain.setValueAtTime(Math.max(0.0001, this.valueAt(g.gain, tr, t, attack)), tr);
        g.gain.exponentialRampToValueAtTime(0.0001, tr + secs);
        // the tail is −48 dB by 60 % of the release: stop the oscillators there (the budget is 12 live)
        for (const o of srcs) { o.stop(tr + secs * 0.6 + 0.05); this.restop(o, tr + secs * 0.6 + 0.05); }
      },
      // a cancelled bar scheduled the release: take it back (the release lies in the future, so cancelling from it is exact)
      unrelease: () => {
        if (v.releaseAt === undefined) return;
        const tr = v.releaseAt; v.releaseAt = undefined;
        g.gain.cancelScheduledValues(tr); g.gain.setValueAtTime(Math.max(0.0001, this.valueAt(g.gain, tr, t, attack)), tr);
        for (const o of srcs) { o.stop(t + 3600); this.restop(o, t + 3600); }
      },
    };
    return v;
  }
  /** the pad gain at `tr`, given a linear attack that started at `t` (release may land mid-attack) */
  private valueAt(_p: AudioParam, tr: number, t: number, attack: number) { return Math.min(1, Math.max(0, (tr - t) / attack)); }

  /** pluck: Karplus-Strong — a noise burst through a feedback delay of 1/f with a 2-point low-pass, computed into a buffer per pitch */
  pluck(n: number, t: number, _d: number, v: number, out: AudioNode = this.into('pluck')) {
    const buf = this.ksBuffer(midiHz(n));
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.start(t); s.stop(t + buf.duration);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.34 * v, t); g.gain.setValueAtTime(0.34 * v, t + buf.duration - 0.08); g.gain.linearRampToValueAtTime(0.0001, t + buf.duration - 0.005);
    s.connect(g).connect(out);
    return { srcs: [s], out: g } as Voice;
  }
  private ksBuffer(f: number): AudioBuffer {
    const key = Math.round(f * 4);
    const hit = this.ks.get(key); if (hit) return hit;
    const sr = this.ctx.sampleRate, N = Math.max(2, Math.round(sr / f)), secs = f > 500 ? 1.4 : 2.0, len = Math.floor(sr * secs);
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let s = 987654321 + key;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; };
    // the burst: white noise, DC removed, a touch of pick-position comb (a copy 30 % of a period later, inverted)
    let mean = 0; for (let i = 0; i < N; i++) { const r = rnd(); d[i] = r; mean += r; } mean /= N;
    for (let i = 0; i < N; i++) d[i] = (d[i] ?? 0) - mean;
    const pick = Math.max(1, Math.round(N * 0.3)); for (let i = N - 1; i >= pick; i--) d[i] = (d[i] ?? 0) - 0.8 * (d[i - pick] ?? 0);
    // a plucked string's burst is not white: one-pole low-pass at ~5 partials (the harmonics roll off ~6 dB/oct)
    const a = 1 - Math.exp((-2 * Math.PI * Math.min(4200, f * 5)) / sr); let y = 0;
    for (let i = 0; i < N; i++) { y += a * ((d[i] ?? 0) - y); d[i] = y; }
    // the loop: y[i] = decay · ½ (y[i−N] + y[i−N−1]) — the averaging is the string's damping
    const decay = f < 200 ? 0.994 : f < 500 ? 0.996 : 0.9975;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * ((d[i - N] ?? 0) + (d[i - N - 1 < 0 ? 0 : i - N - 1] ?? 0));
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i] ?? 0));
    const k = peak > 0 ? 0.95 / peak : 1; for (let i = 0; i < len; i++) d[i] = (d[i] ?? 0) * k;
    this.ks.set(key, buf);
    return buf;
  }

  /** marimba: a sine and its 4th harmonic (the bar's overtone), 3 ms attack, exponential decay; a tiny mallet click */
  marimba(n: number, t: number, _d: number, v: number, out: AudioNode = this.into('marimba')) {
    const c = this.ctx, f = midiHz(n), decay = Math.min(1.1, Math.max(0.3, 1.3 - (n - 60) / 40));
    const g = c.createGain(); this.env(g.gain, t, 0.26 * v, 0.003, decay); g.connect(out);
    const o1 = this.osc('sine', f, t, t + decay + 0.05);
    const o2 = this.osc('sine', f * 4, t, t + 0.3); const g2 = c.createGain(); this.env(g2.gain, t, 0.22, 0.002, 0.12);
    o1.connect(g); o2.connect(g2).connect(g);
    const click = this.noiseSrc(t, t + 0.03); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
    const cg = c.createGain(); this.env(cg.gain, t, 0.09 * v, 0.001, 0.012); click.connect(hp).connect(cg).connect(out);
    return { srcs: [o1, o2, click], out: g } as Voice;
  }

  /** bass: sine + a little saw through the 420 Hz low-pass, 10 ms attack, held for the note, sidechained to the kick */
  bass(n: number, t: number, d: number, v: number, out: AudioNode = this.bassDuck) {
    const c = this.ctx, f = midiHz(n), hold = Math.max(0.05, d - 0.07);
    const g = c.createGain(); this.env(g.gain, t, 0.15 * v, 0.012, 0.07, hold); g.connect(out);
    const o1 = this.osc('sine', f, t, t + hold + 0.15), o2 = this.osc('sawtooth', f, t, t + hold + 0.15, 4);
    const sg = c.createGain(); sg.gain.value = 0.16;
    o1.connect(g); o2.connect(sg).connect(g);
    return { srcs: [o1, o2], out: g } as Voice;
  }

  /** pulse: 36 kick (1 & 3) · 35 the four-on-the-floor kicks · 38 tap · 42 shaker — each to its own sub-bus */
  drum(n: number, t: number, v: number, outOverride?: AudioNode): Voice {
    const c = this.ctx;
    if (n === 36 || n === 35) {
      const out = outOverride ?? this.gains[n === 36 ? 'pulse.kick' : 'pulse.four'];
      const o = this.osc('sine', 135, t, t + 0.4); o.frequency.setValueAtTime(135, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
      const g = c.createGain(); this.env(g.gain, t, 0.36 * v, 0.003, 0.3); o.connect(g).connect(out);
      const click = this.noiseSrc(t, t + 0.03); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const cg = c.createGain(); this.env(cg.gain, t, 0.2 * v, 0.001, 0.014); click.connect(lp).connect(cg).connect(out);
      return { srcs: [o, click], out: g };
    }
    const out = outOverride ?? this.gains['pulse.soft'];
    if (n === 42) {
      const s = this.noiseSrc(t, t + 0.09); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6400; bp.Q.value = 1.1;
      const g = c.createGain(); this.env(g.gain, t, 0.6 * v, 0.006, 0.055); s.connect(bp).connect(g).connect(out);
      return { srcs: [s], out: g };
    }
    // 38: the tap — a damp knock, noise through a 1.4 kHz band and a 190 Hz thump
    const s = this.noiseSrc(t, t + 0.06); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.8;
    const g = c.createGain(); this.env(g.gain, t, 0.9 * v, 0.002, 0.035); s.connect(bp).connect(g).connect(out);
    const o = this.osc('sine', 190, t, t + 0.08); const og = c.createGain(); this.env(og.gain, t, 0.5 * v, 0.002, 0.05); o.connect(og).connect(out);
    return { srcs: [s, o], out: g };
  }

  /** bell: 2-operator FM — a sine carrier, a modulator at 3.5× (the inharmonic bell partial) whose index decays fast */
  bell(n: number, t: number, d: number, v: number, out: AudioNode = this.into('bell')) {
    const c = this.ctx, f = midiHz(n), decay = Math.max(1.2, d);
    const car = this.osc('sine', f, t, t + decay + 0.1), mod = this.osc('sine', f * 3.5, t, t + decay + 0.1);
    const mg = c.createGain(); mg.gain.setValueAtTime(f * 2.8, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.8);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain(); this.env(g.gain, t, 0.3 * v, 0.004, decay); car.connect(g).connect(out);
    return { srcs: [car, mod], out: g } as Voice;
  }

  // ─────────────── mixer ───────────────
  private param(key: MixKey): AudioParam { return key === 'lpf' ? this.lpf.frequency : key === 'chorus' ? this.chorusWet.gain : this.gains[key].gain; }
  private hold(p: AudioParam, t: number) {
    const cp: { cancelAndHoldAtTime?: (t: number) => void } = p; // Firefox has no cancelAndHoldAtTime
    if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
  }
  /** ramp a layer / effect to `level` starting at `t` over `ramp` seconds (bar-aligned when the sequencer calls it) */
  setLevel(key: MixKey, level: number, t: number, ramp = 0.02) {
    const target = this.solo && key !== 'lpf' && key !== 'chorus' && !this.solo.has(key) ? 0 : level;
    const p = this.param(key), from = this.targets[key] ?? p.value;
    this.hold(p, t);
    if (key === 'lpf') {
      p.setValueAtTime(Math.max(20, from), t); p.exponentialRampToValueAtTime(Math.max(20, target), t + Math.max(0.005, ramp));
    } else {
      p.setValueAtTime(from, t); p.linearRampToValueAtTime(target, t + Math.max(0.005, ramp));
    }
    this.targets[key] = target;
  }
  /** the game state → layer levels (project/archive/2026-09-23-music.md "In the game"); `menu` follows the arrangement's own mix instead */
  private stateLevels(seg: Segment): Partial<Record<GainKey, number>> {
    const s = this.state, i = Math.min(1, Math.max(0, s.intensity));
    const mine: LayerId = s.shard === 'island' ? 'marimba' : 'pluck', other: LayerId = mine === 'pluck' ? 'marimba' : 'pluck';
    const motif = mine === 'pluck' ? 0.9 : 0.85;
    void seg;
    if (s.mode === 'combat') return { drone: 1, pad: 0.85, [mine]: 1, [other]: 0.35, bass: 1, 'pulse.soft': 1, 'pulse.kick': 1, 'pulse.four': 0.7 + 0.3 * i, bell: 1 };
    if (s.mode === 'alert') return { drone: 1, pad: 0.8, [mine]: motif, [other]: 0, bass: 0.7 + 0.3 * i, 'pulse.soft': 0.5 + 0.5 * i, 'pulse.kick': 0, 'pulse.four': 0, bell: 1 };
    return { drone: 1, pad: 0.75, [mine]: motif, [other]: 0, bass: 0, 'pulse.soft': 0, 'pulse.kick': 0, 'pulse.four': 0, bell: 1 };
  }
  /** calm / alert let the motif through only in the sections flagged `calmMotif` (B and D: every ~30 s at 96) — gated at the note, so nothing bleeds across a bar */
  private motifGate(seg: Segment) { return this.driven || this.state.mode === 'combat' || seg.calmMotif === true; }
  private get driven() { return this.arrangement?.driven === true || this.state.mode === 'menu'; }
  private get dorian() { return !this.driven && this.state.mode === 'combat'; }
  private bpmFor(seg: Segment) { return seg.at !== undefined || this.arrangement?.driven ? seg.bpm : TEMPO[this.state.mode]; }

  // ─────────────── sequencer ───────────────
  /** fill the Karplus-Strong cache for every pluck pitch the arrangement uses (and their Dorian forms) — ~1 ms each, off the bar schedule */
  warm(arr: Arrangement) {
    for (const seg of arr.segments) for (const n of seg.notes.pluck ?? []) { this.ksBuffer(midiHz(n.n)); this.ksBuffer(midiHz(dorianPitch(n.n))); }
  }
  /** start `arr` at time `t` (the drone comes up with it) */
  begin(arr: Arrangement, t: number) {
    this.arrangement = arr; this.segIdx = 0; this.beat0 = 0; this.nextT = t; this.bars = []; this.lastChord = undefined;
    this.pad = undefined;
    for (const k of GAIN_KEYS) if (k !== 'pulse') { this.gains[k].gain.cancelScheduledValues(t); this.gains[k].gain.setValueAtTime(0, t); this.targets[k] = 0; }
    this.startDrone(t);
  }
  /** schedule every bar that starts before `until` (the live pump calls this with now + 2 bars; offline, with the render length) */
  pump(until: number) {
    const arr = this.arrangement; if (!arr) return;
    const now = this.ctx.currentTime;
    let head = this.bars[0];
    while (head !== undefined && head.t0 + head.beats * head.spb < now - 0.5) { this.bars.shift(); head = this.bars[0]; }
    let guard = 0;
    while (this.nextT < until && guard++ < 512) if (!this.scheduleNext()) break;
  }
  private scheduleNext(): boolean {
    const arr = this.arrangement; if (!arr) return false;
    const loopEnd = arr.tailFrom ?? arr.segments.length;
    let seg = arr.segments[this.segIdx];
    if (seg === undefined) return false; // past the last segment
    if (this.beat0 >= seg.beats - 1e-6) {
      this.segIdx++; this.beat0 = 0;
      if (this.segIdx >= loopEnd && arr.loopTo !== undefined) this.segIdx = arr.loopTo;
      seg = arr.segments[this.segIdx];
      if (seg === undefined) return false;
    }
    const spb = 60 / this.bpmFor(seg);
    const t0 = seg.at !== undefined ? seg.at + this.beat0 * spb : this.nextT;
    const beats = Math.min(4, seg.beats - this.beat0);
    const t = performance.now();
    this.scheduleBar(seg, this.segIdx, this.beat0, beats, t0, spb);
    const ms = performance.now() - t; this.stats.schedMs += ms; this.stats.schedMax = Math.max(this.stats.schedMax, ms);
    this.beat0 += beats; this.nextT = t0 + beats * spb;
    return true;
  }
  private scheduleBar(seg: Segment, segIdx: number, beat0: number, beats: number, t0: number, spb: number) {
    const bar: Bar = { segIdx, beat0, beats, t0, spb, voices: [], before: { pad: this.pad, targets: { ...this.targets }, lastChord: this.lastChord } };
    const end = beat0 + beats, at = (b: number) => t0 + (b - beat0) * spb, dorian = this.dorian;
    // mixer: the arrangement's mix events (driven) or the state table (game), crossfading over the bar
    if (this.driven) {
      for (const m of seg.mix ?? []) if (m.t >= beat0 && m.t < end) this.setLevel(m.key, m.level, at(m.t), m.ramp ?? 0.02);
    } else {
      const lv = this.stateLevels(seg);
      for (const k of Object.keys(lv) as GainKey[]) { const level = lv[k]; if (level !== undefined && this.targets[k] !== level) this.setLevel(k, level, t0, beats * spb); }
    }
    // chords → pad (and the drone just holds D)
    for (const c of seg.chords) if (c.t >= beat0 && c.t < end) {
      const name = dorian ? DORIAN_OF[c.chord] : c.chord, tc = at(c.t);
      const attack = Math.min(1.4, Math.max(0.05, spb * 2.2));
      if (this.pad) this.pad.release(tc, Math.max(0.8, spb * 3.2));
      this.pad = this.padVoice(name, tc, attack); this.lastChord = name; bar.voices.push(this.pad);
    }
    // notes
    const notes = seg.notes;
    const each = (list: NoteEv[] | undefined, fn: (n: NoteEv, tn: number) => Voice | undefined) => {
      if (!list) return;
      for (const n of list) if (n.t >= beat0 && n.t < end) { const v = fn(n, at(n.t)); if (v) bar.voices.push(v); this.stats.notes++; }
    };
    const pitch = (n: number) => (dorian ? dorianPitch(n) : n), gate = this.motifGate(seg);
    each(gate ? notes.pluck : undefined, (n, tn) => this.pluck(pitch(n.n), tn, n.d * spb, n.v ?? 0.8));
    each(gate ? notes.marimba : undefined, (n, tn) => this.marimba(pitch(n.n), tn, n.d * spb, n.v ?? 0.8));
    each(notes.bass, (n, tn) => this.bass(dorian ? this.dorianRoot(n.n, seg, n.t) : n.n, tn, n.d * spb, n.v ?? 0.8));
    each(notes.bell, (n, tn) => this.bell(pitch(n.n), tn, n.d * spb, n.v ?? 0.8));
    each(notes.pulse, (n, tn) => {
      const v = this.drum(n.n, tn, n.v ?? 0.8);
      if ((n.n === 36 && (this.targets['pulse.kick'] ?? 0) > 0.05) || (n.n === 35 && (this.targets['pulse.four'] ?? 0) > 0.05)) this.sidechain(tn);
      return v;
    });
    this.bars.push(bar); this.stats.bars++;
  }
  /** the bass follows the Dorian chord's root under a Lydian bar */
  private dorianRoot(n: number, seg: Segment, t: number): number {
    const c = [...seg.chords].reverse().find((x) => x.t <= t); if (!c) return n;
    return n - CHORD_ROOT[c.chord] + CHORD_ROOT[DORIAN_OF[c.chord]];
  }
  private sidechain(t: number) {
    const g = this.bassDuck.gain;
    g.setValueAtTime(1, Math.max(0, t - 0.003)); g.linearRampToValueAtTime(0.32, t + 0.012); g.linearRampToValueAtTime(1, t + 0.24);
  }
  /** drop every bar that has not started yet and rewind the cursor to the first of them (state changes take effect on the next bar) */
  cancelPending(now: number) {
    const i = this.bars.findIndex((b) => b.t0 > now + 0.03);
    if (i === -1) return;
    const first = this.bars[i];
    if (first === undefined) return;
    for (const b of this.bars.splice(i)) for (const v of b.voices) { try { v.out.disconnect(); } catch { /* gone */ } for (const s of v.srcs) { try { s.stop(now); } catch { /* not started */ } this.restop(s, now); } }
    this.pad = first.before.pad; this.lastChord = first.before.lastChord; this.targets = { ...first.before.targets };
    for (const k of GAIN_KEYS) { const p = this.gains[k].gain; this.hold(p, first.t0); p.setValueAtTime(this.targets[k] ?? 0, first.t0); }
    this.bassDuck.gain.cancelScheduledValues(first.t0); this.bassDuck.gain.setValueAtTime(1, first.t0);
    if (this.pad) this.pad.unrelease(); // a cancelled chord had released it; the rescheduled chord will again
    this.segIdx = first.segIdx; this.beat0 = first.beat0; this.nextT = first.t0;
  }
  /** the start of the next bar after `now` (for bar-aligned stops / stings), or now if nothing is scheduled */
  nextBarAfter(now: number): number { const b = this.bars.find((x) => x.t0 > now); return b ? b.t0 : now; }
  currentSpb(): number { const b = this.bars[this.bars.length - 1]; return b ? b.spb : 60 / TEMPO[this.state.mode]; }
  /** silence everything; the bars already scheduled stop at `t` */
  end(t: number) {
    if (this.pad) this.pad.release(t, 0.4);
    for (const b of this.bars) for (const v of b.voices) { try { v.out.gain.setValueAtTime(v.out.gain.value, t); v.out.gain.linearRampToValueAtTime(0, t + 0.05); } catch { /* */ } for (const s of v.srcs) { try { s.stop(t + 0.1); } catch { /* */ } this.restop(s, t + 0.1); } }
    this.bars = []; this.arrangement = undefined; this.pad = undefined;
    for (const n of this.droneNodes) { try { n.stop(t + 0.1); } catch { /* */ } this.restop(n, t + 0.1); } this.droneNodes = [];
  }

  // ─────────────── stings (their own bus, so the death duck never swallows them) ───────────────
  sting(sting: StingName, t: number) {
    const spb = this.currentSpb(), name = sting === 'dawn' ? 'chunk' : sting; // the synth has no dawn sting: the discovery chord
    if (name === 'pickup') { for (const n of STING_PICKUP) this.bell(n.n, t + n.t * spb, n.d * spb, n.v ?? 0.6, this.stingBus); return; }
    if (name === 'chunk') {
      const p = this.padVoice(STING_CHUNK.chord, t, 0.03, this.stingBus); p.release(t + 0.4, 2.6);
      for (const n of STING_CHUNK.bell) this.bell(n.n, t + n.t * spb, n.d * spb, n.v ?? 0.6, this.stingBus);
      this.bass(38, t, 1.4, 0.9, this.stingBus); this.drum(36, t, 0.9, this.stingBus);
      return;
    }
    // death: the minor turn — Dm9 → Gm over a bar — then the sequencer ducks to silence for 6 s and comes back over a bar
    const bar = spb * 4;
    const a = this.padVoice(STING_DEATH.chords[0], t, 0.05, this.stingBus); a.release(t + bar * 0.5, 1.2);
    const b = this.padVoice(STING_DEATH.chords[1], t + bar * 0.5, 0.08, this.stingBus); b.release(t + bar, 2.4);
    for (const n of STING_DEATH.bass) this.bass(n.n, t + n.t * spb, n.d * spb, n.v ?? 0.9, this.stingBus);
    this.bell(62, t + bar * 0.5, 3, 0.4, this.stingBus);
    const g = this.seq.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + bar);
    g.setValueAtTime(0, t + bar + 6); g.linearRampToValueAtTime(1, t + bar + 6 + bar);
  }
}

/** the tension stem's gain per mode (project/archive/2026-09-23-music.md v3: calm 0, alert ~0.5, combat 1; the title cut has none) */
const TENSION: Record<MusicMode, number> = { menu: 0, calm: 0, alert: 0.5, combat: 1 };
const holdAt = (p: AudioParam, t: number) => {
  const cp: { cancelAndHoldAtTime?: (t: number) => void } = p; // Firefox has no cancelAndHoldAtTime
  if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
};

/** the live game wrapper: timer, state, volume, stings, the stem player, the offline render */
export class Music {
  /** ctx + the music bus (`volume` × the Settings 'music' slider → duck → audio.master) + the engine + the stems' bus, built on
   *  first use (play, after the first gesture) so boot never creates the AudioContext; state set before then waits in `pending` */
  private rig: { ctx: AudioContext; out: GainNode; duckGain: GainNode; engine: Engine; stemBus: GainNode } | undefined;
  /** the shard comes from the active chunk (like Audio's bed): Driftwood, the default chunk, is 'island' — PH-0.4 B8 */
  private pending: MusicState = { shard: getActiveChunk().ocean ? 'island' : 'pine', mode: 'menu', intensity: 0, underwater: false };
  private timer = 0;
  private _volume: number;
  private playing: ArrangementName | undefined;
  private combatTimer = 0;
  // ── v3: the stems ──
  private _style: MusicStyle = getMusicStyle();
  /** the resident style: decoded at the loading bar (useBank), or from the offline cache after a menu switch */
  private bank: StyleBank | undefined;
  /** the style being decoded for a switch (the old one plays on meanwhile) */
  private decoding: MusicStyle | undefined;
  private deck: Deck | undefined;
  /** the synth sequencer is scheduling (its timer runs); `synthGen` voids a pending stop when it is restarted mid-fade */
  private synthOn = false;
  private synthGen = 0;
  /** styles that failed to decode this session — the synth plays them; picking a style again retries */
  private failed = new Set<MusicStyle>();
  private _duck = 1;
  // ── Pine Hollow's slots (PH-A1) ──
  private _scene: PineScene = 'day';
  private _phase: BossPhase = 1;
  /** the Pine Hollow slot decoded for the resident style (one at a time) and the dawn sting */
  private ph: { style: MusicStyle; slot: SlotAudio | undefined; dawn: AudioBuffer | undefined } | undefined;
  private phDecoding: string | undefined;
  /** style/slot pairs that failed to decode this session: the theme plays for them */
  private phFailed = new Set<string>();
  private prefetched = new Set<MusicStyle>();
  /** `?music=pine-dawn`: play the dawn sting once the Pine Hollow stems play */
  private urlDawn = false;

  constructor(private readonly audio: Audio) {
    const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('music');
    const m = q === null ? null : /^pine-(night|boss|dawn)(?:-([123]))?$/.exec(q);
    if (m) {
      if (m[1] === 'night' || m[1] === 'boss') this._scene = m[1];
      if (m[1] === 'dawn') this.urlDawn = true;
      if (m[2] === '2' || m[2] === '3') this._phase = m[2] === '2' ? 2 : 3;
    }
    this._volume = getNumber('music');
    onNumber('music', (v) => { this._volume = v; if (this.rig) this.rig.out.gain.setTargetAtTime(v, this.rig.ctx.currentTime, 0.05); });
    onMusicStyle((v) => { this._style = v; this.failed.clear(); this.phFailed.clear(); if (!this.rig || !this.playing) this.prepare(v); this.sync(); });
  }

  private build(): NonNullable<Music['rig']> {
    if (this.rig) return this.rig;
    const ctx = this.audio.ctx, out = ctx.createGain(), duckGain = ctx.createGain();
    out.gain.value = this._volume; duckGain.gain.value = this._duck;
    out.connect(duckGain).connect(this.audio.master);
    const engine = new Engine(ctx, out);
    const stemBus = ctx.createGain(); stemBus.connect(engine.bus); // through the engine's low-pass + chorus: underwater muffles the stems too
    this.rig = { ctx, out, duckGain, engine, stemBus };
    this.setState(this.pending);
    return this.rig;
  }
  get ctx(): AudioContext { return this.build().ctx; }
  get engine(): Engine { return this.build().engine; }
  get out(): GainNode { return this.build().out; }

  get state(): MusicState { return this.rig ? this.rig.engine.state : this.pending; }
  get stats(): Engine['stats'] { return this.engine.stats; }
  get volume(): number { return this._volume; }
  set volume(v: number) { setNumber('music', v); }
  get isPlaying(): boolean { return this.playing !== undefined; }
  get style(): MusicStyle { return this._style; }
  /** diagnostics (dev / headless checks): what is sounding, the tension stem's live gain, what was fetched and how long it took */
  get stems(): { style: MusicStyle; source: 'synth' | 'stems'; slot: SlotName | undefined; tension: number | undefined; synthOn: boolean; synthMix: number | undefined; duck: number | undefined; loads: { file: string; bytes: number; ms: number }[]; failed: string[]; scene: PineScene; phase: BossPhase; layers: number[] } {
    return {
      style: this._style, source: this.deck ? 'stems' : 'synth', slot: this.deck?.slot, tension: this.deck?.tensionGain?.gain.value,
      synthOn: this.synthOn, synthMix: this.rig?.engine.synthMix.gain.value, duck: this.rig?.duckGain.gain.value,
      loads: this.bank ? [...this.bank.log] : [], failed: [...this.failed, ...this.phFailed],
      scene: this._scene, phase: this._phase, layers: this.deck ? this.deck.layerGains.map((g) => g.gain.value) : [],
    };
  }
  get pineScene(): PineScene { return this._scene; }
  get bossPhase(): BossPhase { return this._phase; }

  /** Pine Hollow's scene — the day clock ('night' at dusk, 'day' at dawn) and the boss fight ('boss', back to 'day' / 'night' after).
   *  Crossfades on the bar once that slot is decoded (the theme plays on meanwhile). No effect on the other shards. */
  setPineScene(scene: PineScene): void {
    if (scene === this._scene) return;
    this._scene = scene;
    if (scene === 'boss') this._phase = 1;
    this.sync();
  }
  /** the Antler King's phase: I the Warden · II Lanterns Fall · III the Last Light — the boss track's layers move on its next bar */
  setBossPhase(phase: BossPhase): void {
    if (phase === this._phase) return;
    this._phase = phase;
    if (this.rig && this.deck?.slot === 'boss') this.deck.setPhase(phase, this.rig.ctx.currentTime);
  }
  /** pull the selected style's Pine Hollow files into the offline cache (the service worker keeps what it fetches), once per style,
   *  when the browser is idle — so night / boss decode from the cache later. Pine Hollow calls it after the player is in. */
  prefetchPine(): void {
    const style = this._style;
    if (style === 'synth' || this.prefetched.has(style)) return;
    this.prefetched.add(style);
    const files = setFiles(style, 'pine-hollow');
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
    const go = (): void => { void (async () => { for (const f of files) { try { await cachedBytes(f); } catch { /* offline: decoded later or the theme plays */ } } })(); };
    if (idle) idle(go); else window.setTimeout(go, 2000);
  }

  /** the stems the loading bar decoded (src/boot/extras.ts) — the selected style's title + this shard's slot + stings */
  useBank(bank: StyleBank): void {
    if (bank.style !== this._style) return; // the style changed while the bar ran: prepare() decodes that one
    this.bank = bank;
    this.sync();
  }

  /** start an arrangement (the game uses 'theme'); restarts if already playing. The stems start at once when decoded, else the synth. */
  play(name: ArrangementName = 'theme'): void {
    const t = this.ctx.currentTime + 0.05;
    if (this.playing) { this.stopTimer(); this.synthOn = false; this.engine.end(t); this.deck?.fadeOut(t, 0.05); this.deck = undefined; }
    this.playing = name;
    if (name === 'theme' && this.stemsReady()) { this.sync(); return; } // the decoded deck from silence — no synth bridge
    this.startSynth(t, 0);
    const arr = ARRANGEMENTS[name];
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
    if (idle) idle(() => this.engine.warm(arr)); else window.setTimeout(() => this.engine.warm(arr), 300);
    if (name === 'theme') this.sync();
  }
  private stemsReady(): boolean { const b = this.bank; return this._style !== 'synth' && b !== undefined && b.style === this._style && b.slots.has(this.baseSlot()); }
  private pump() {
    const spb = this.engine.currentSpb();
    this.engine.pump(this.ctx.currentTime + LOOKAHEAD_BARS * 4 * spb);
  }
  private stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = 0; } }

  /** the synth sequencer on (from the top of the arrangement if it was off), its share of the bus up over `fade` from `t` */
  private startSynth(t: number, fade: number): void {
    const e = this.engine, g = e.synthMix.gain;
    this.synthGen++; // voids a stop still pending from a fade-out
    if (!this.synthOn) {
      e.seq.gain.cancelScheduledValues(t); e.seq.gain.setValueAtTime(1, t);
      e.begin(ARRANGEMENTS[this.playing ?? 'theme'], t);
      this.synthOn = true;
      this.pump();
      this.timer = window.setInterval(() => this.pump(), TICK_MS);
      g.cancelScheduledValues(t); g.setValueAtTime(fade > 0 ? 0 : 1, t);
    } else holdAt(g, t);
    if (fade > 0) g.linearRampToValueAtTime(1, t + fade);
  }
  /** the synth's share down over `fade` from `t`, then its scheduler stops (no CPU while the stems play) */
  private stopSynth(t: number, fade: number): void {
    if (!this.synthOn) return;
    const g = this.engine.synthMix.gain;
    holdAt(g, t); g.linearRampToValueAtTime(0, t + fade);
    const gen = ++this.synthGen;
    window.setTimeout(() => {
      if (gen !== this.synthGen || !this.synthOn) return; // restarted meanwhile
      this.stopTimer(); this.synthOn = false; this.engine.end(this.ctx.currentTime);
    }, Math.max(0, t + fade - this.ctx.currentTime) * 1000 + 150);
  }

  // ─────────────── the stems (project/archive/2026-09-23-music.md v3 row 7) ───────────────
  /** the slot the state asks for: the title cut on the menu, else the shard's theme */
  private wantSlot(): SlotName {
    const s = this.state;
    if (s.mode !== 'menu' && s.shard === 'pine' && this._scene !== 'day') return this._scene; // 'night' | 'boss' (PH-A1)
    return this.baseSlot();
  }
  /** the slot of the base set: the title on the menu, else the shard's theme (Pine Hollow's night / boss fall back to 'pine') */
  private baseSlot(): SlotName {
    const s = this.state;
    return s.mode === 'menu' ? 'title' : s.shard === 'island' ? 'island' : 'pine';
  }
  private tension(): number { return TENSION[this.state.mode]; }

  /** bring what plays in line with the style + state: hand over to / from the synth, switch decks, move the tension stem */
  private sync(): void {
    if (!this.rig || !this.playing) return;
    const now = this.rig.ctx.currentTime, style = this._style;
    if (style === 'synth' || this.failed.has(style)) { this.toSynth(now); return; }
    this.deck?.setTension(this.tension(), now); // a deck of another slot / style plays on (at the right level) until the new one is in
    const bank = this.bank;
    if (bank?.style !== style) { this.prepare(style); if (!this.deck && !this.synthOn) this.startSynth(now + 0.05, 1); return; }
    let slot = this.wantSlot();
    if (slot === 'night' || slot === 'boss') {
      const ph = this.ph?.style === style ? this.ph.slot : undefined;
      if (ph?.slot === slot) {
        if (this.deck?.slot === slot && this.deck.style === style) { this.deck.setPhase(this._phase, now); return; }
        this.startDeck(ph);
        return;
      }
      this.preparePine(style, slot); // decoded in the background: the theme plays until it is in (or for good, if it fails)
      slot = this.baseSlot();
    }
    if (this.deck?.slot === slot && this.deck.style === style) return;
    const a = bank.slots.get(slot);
    if (a === undefined) { this.toSynth(now); return; } // this style has no such slot in the build (or it failed to decode)
    this.startDeck(a);
  }
  /** decode one Pine Hollow slot (+ the dawn sting) of `style` from the offline cache, or the network if it never got there */
  private preparePine(style: MusicStyle, slot: 'night' | 'boss'): void {
    const key = `${style}/${slot}`;
    if (this.phDecoding === key || this.phFailed.has(key)) return;
    this.phDecoding = key;
    void (async () => {
      let bank: StyleBank | undefined;
      try { bank = await decodeStyle(style, [slot], cachedBytes, decodeBytes, undefined, 'pine-hollow', ['dawn']); }
      catch (err: unknown) { console.info(`[music] pine-hollow ${key}: ${err instanceof Error ? err.message : String(err)} — the theme plays`); }
      finally { if (this.phDecoding === key) this.phDecoding = undefined; }
      const a = bank?.slots.get(slot);
      if (!a) { this.phFailed.add(key); return; }
      if (this._style !== style) return;
      // one Pine Hollow slot resident: the other's buffers go (a fading deck keeps its own until it ends)
      this.ph = { style, slot: a, dawn: bank?.stings.get('dawn') ?? (this.ph?.style === style ? this.ph.dawn : undefined) };
      this.sync();
    })();
  }
  /** the dawn sting of `style`, decoded on its own when no Pine Hollow slot has been (≈ 8 s, tiny) */
  private async dawnSting(style: MusicStyle): Promise<AudioBuffer | undefined> {
    if (this.ph?.style === style && this.ph.dawn) return this.ph.dawn;
    try {
      const bank = await decodeStyle(style, [], cachedBytes, decodeBytes, undefined, 'pine-hollow', ['dawn']);
      const buf = bank.stings.get('dawn');
      if (buf && this._style === style) this.ph = { style, slot: this.ph?.style === style ? this.ph.slot : undefined, dawn: buf };
      return buf;
    } catch { return undefined; }
  }
  /** decode `style` from the offline cache (a menu switch; the bar already downloaded every style) — the old style plays on */
  private prepare(style: MusicStyle): void {
    if (style === 'synth' || this.bank?.style === style || this.decoding === style || this.failed.has(style)) return;
    this.decoding = style;
    void this.decodeFor(style);
  }
  private async decodeFor(style: MusicStyle): Promise<void> {
    const slots: SlotName[] = ['title', this.state.shard === 'island' ? 'island' : 'pine'];
    let bank: StyleBank;
    try { bank = await trackBusy('music', decodeStyle(style, slots, cachedBytes, decodeBytes)); }
    catch (err: unknown) {
      this.failed.add(style);
      console.info(`[music] ${style}: ${err instanceof Error ? err.message : String(err)} — the synth plays on`);
      this.sync();
      return;
    } finally { if (this.decoding === style) this.decoding = undefined; }
    if (this._style !== style) return; // picked something else meanwhile
    this.bank = bank; // the previous style's buffers go with it (a fading deck holds its own until it ends)
    this.sync();
  }

  /** a decoded slot takes over on a bar: from the synth (its bar grid) or from the other deck (that deck's grid), faded over ≥ 1 bar */
  private startDeck(a: SlotAudio): void {
    if (!this.rig) return;
    const now = this.rig.ctx.currentTime, old = this.deck;
    const bar = (60 / a.spec.bpm) * a.spec.beatsPerBar;
    let t: number, fade: number;
    if (old) {
      t = old.nextBar(now + 0.05); fade = Math.max(bar, old.bar, 2);
      old.fadeOut(t, fade);
    } else if (this.synthOn) {
      t = Math.max(now + 0.05, this.engine.nextBarAfter(now + 0.05)); fade = Math.max(bar, 2);
    } else {
      t = now + 0.05; fade = 1; // from silence (play() with the stems already decoded)
    }
    this.deck = new Deck(this.rig.ctx, a, this.rig.stemBus, t, fade, this.tension(), this._phase);
    this.stopSynth(t, fade);
    if (this.urlDawn && a.slot !== 'title' && a.style === this._style && this.state.shard === 'pine') { this.urlDawn = false; window.setTimeout(() => this.sting('dawn'), 2000); }
  }

  /** the deck (if any) out over a bar on its grid, the synth back in under it */
  private toSynth(now: number): void {
    const d = this.deck;
    if (!d) { if (!this.synthOn && this.playing) this.startSynth(now + 0.05, 1); return; }
    const t = d.nextBar(now + 0.05), fade = Math.max(d.bar, 2);
    d.fadeOut(t, fade); this.deck = undefined;
    this.startSynth(t, fade);
  }

  /** fade over a bar and silence every voice */
  stop(): void {
    if (!this.playing) return;
    const t = this.ctx.currentTime;
    if (this.synthOn) {
      this.stopTimer(); this.synthOn = false; this.synthGen++;
      const bar = this.engine.currentSpb() * 4, g = this.engine.seq.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + bar);
      this.engine.end(t + bar);
    }
    if (this.deck) { this.deck.fadeOut(t, this.deck.bar); this.deck = undefined; }
    this.playing = undefined;
  }

  /** the game → the music: mode/shard/intensity take effect on the next bar (pending bars are rescheduled); underwater is immediate */
  setState(next: Partial<MusicState>): void {
    if (!this.rig) { Object.assign(this.pending, next); this.pending.intensity = Math.min(1, Math.max(0, this.pending.intensity)); return; }
    const s = this.rig.engine.state, prev = { ...s };
    Object.assign(s, next);
    s.intensity = Math.min(1, Math.max(0, s.intensity));
    const now = this.ctx.currentTime;
    if (s.underwater !== prev.underwater && !this.engine.arrangement?.driven) {
      this.engine.setLevel('lpf', s.underwater ? 600 : 20000, now, s.underwater ? 0.35 : 0.5);
      this.engine.setLevel('chorus', s.underwater ? 0.55 : 0, now, 0.6);
    }
    if (this.playing && (s.mode !== prev.mode || s.shard !== prev.shard || s.intensity !== prev.intensity)) {
      if (this.synthOn) { this.engine.cancelPending(now); this.pump(); }
      this.sync();
    }
  }
  /** a combat event (a charge, a hit landed or taken): combat now, decaying to alert 8 s after the last one */
  combat(intensity = 0.7): void {
    this.setState({ mode: 'combat', intensity: Math.max(this.state.intensity, intensity) });
    window.clearTimeout(this.combatTimer);
    this.combatTimer = window.setTimeout(() => { if (this.state.mode === 'combat') this.setState({ mode: 'alert', intensity: 0.5 }); }, 8000);
  }

  /** the style's sting file while its stems play, else the synth sting; the death sting ducks the stems like the synth (a bar down, 6 s out, a bar back) */
  sting(name: StingName): void {
    if (!this.rig) return;
    const { ctx, engine, stemBus } = this.rig, t = ctx.currentTime + 0.02, deck = this.deck;
    if (name === 'dawn') { this.dawn(); return; }
    const buf = deck && this.bank?.style === deck.style ? this.bank.stings.get(name) : undefined;
    if (buf) { const src = ctx.createBufferSource(); src.buffer = buf; src.connect(engine.stingBus); src.start(t); }
    else engine.sting(name, t);
    if (name === 'death' && deck) {
      const g = stemBus.gain, bar = deck.bar;
      holdAt(g, t); g.linearRampToValueAtTime(0, t + bar); g.setValueAtTime(0, t + bar + 6); g.linearRampToValueAtTime(1, t + bar * 2 + 6);
    }
  }

  /** the quest's reward sting (PH-A1): the dawn take's resolve over the score, which dips under it (a beat down, back over 2 bars
   *  after); the synth's discovery chord when the style is synth or the file is not in the build / will not decode */
  private dawn(): void {
    const style = this._style;
    if (!this.rig) return;
    if (style === 'synth' || !this.deck) { this.rig.engine.sting('dawn', this.rig.ctx.currentTime + 0.02); return; }
    void (async () => {
      const buf = await this.dawnSting(style);
      if (!this.rig) return;
      const { ctx, engine, stemBus } = this.rig, t = ctx.currentTime + 0.02;
      if (!buf) { engine.sting('dawn', t); return; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(engine.stingBus); src.start(t);
      const d = this.deck, beat = d ? d.bar / 4 : 0.5, g = stemBus.gain;
      holdAt(g, t); g.linearRampToValueAtTime(0.25, t + beat); g.setValueAtTime(0.25, t + buf.duration - 1); g.linearRampToValueAtTime(1, t + buf.duration - 1 + (d ? d.bar * 2 : 4));
    })();
  }

  /** scale the whole music bus (1 = untouched): the shrine ducks it −3 dB up close. Cheap to call per frame — only a real change schedules. */
  duck(k: number): void {
    const v = Math.min(1, Math.max(0, k));
    if (Math.abs(v - this._duck) < 0.004) return;
    this._duck = v;
    if (this.rig) this.rig.duckGain.gain.setTargetAtTime(v, this.rig.ctx.currentTime, 0.25);
  }

  /** the same instruments and scheduler on an OfflineAudioContext (48 kHz stereo) → an AudioBuffer of `seconds` */
  static async renderOffline(name: ArrangementName, seconds: number, opts: { state?: Partial<MusicState> | undefined; solo?: string[] | undefined } = {}): Promise<AudioBuffer> {
    const sr = 48000, off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    // the same master chain the live mix goes through (Audio.ts): a gentle compressor before the output
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.16;
    comp.connect(off.destination);
    const eng = new Engine(off, comp);
    if (opts.state) Object.assign(eng.state, opts.state);
    if (opts.solo) eng.solo = new Set(opts.solo);
    eng.begin(ARRANGEMENTS[name], 0);
    eng.pump(seconds);
    // a final fade so a loop render never ends on a click
    eng.bus.gain.setValueAtTime(1, Math.max(0, seconds - 0.6)); eng.bus.gain.linearRampToValueAtTime(0, seconds - 0.02);
    const buf = await off.startRendering();
    // the file's ceiling: if the densest bar pokes above −1.5 dBFS, trim the whole render to it (a few tenths of a dB at most)
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i] ?? 0)); }
    const ceil = 10 ** (-1.5 / 20);
    if (peak > ceil) for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c), k = ceil / peak; for (let i = 0; i < d.length; i++) d[i] = (d[i] ?? 0) * k; }
    return buf;
  }
  renderOffline(name: ArrangementName, seconds: number, opts?: { state?: Partial<MusicState> | undefined; solo?: string[] | undefined }): Promise<AudioBuffer> { return Music.renderOffline(name, seconds, opts); }

  /** WAV bytes (16-bit PCM) of an AudioBuffer — for scripts/music/render.mjs */
  static toWav(buf: AudioBuffer): ArrayBuffer {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, bytes = 44 + n * ch * 2;
    const ab = new ArrayBuffer(bytes), dv = new DataView(ab);
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.codePointAt(i) ?? 0); };
    str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
    let o = 44;
    for (let i = 0; i < n; i++) for (const chan of chans) { const v = Math.max(-1, Math.min(1, chan[i] ?? 0)); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
    return ab;
  }
}
