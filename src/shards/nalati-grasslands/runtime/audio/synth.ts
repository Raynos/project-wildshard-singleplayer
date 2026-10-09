import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';
import { sharedWeaponVoices } from '@wildshard/sdk/runtime/audio/weaponVoices';
import { Scope } from '@wildshard/engine/app/scope';
import type { Audio, HoofSurface, ImpactKind } from '@wildshard/engine/audio/Audio';
import { ownAudioSource } from '@wildshard/engine/audio/ownership';
import { audioRandom } from '@wildshard/engine/audio/util';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
/**
 * Nalati's synth voices (07 §6.5 A.3, moved verbatim out of the engine mixer): the steppe's creature calls, hooves and the
 * stampede, the steppe weapons (bow / javelin / sabre / spear), the storm beds, thunder and the lightning crackle, and the
 * synth steppe bed (grass wind by gust, the river, the waterfall, the camp stove, larks by day, crickets at night).
 * Every one plays the set's sampled take first when it decoded (`audio.shot`), else its synth, on the engine's building
 * blocks (`audio.tone` / `burst` / `route`). The `tap.sound` ids and kinds are the ones the engine mixer used.
 *
 *   const voices = installSteppeVoices(audio, scope, hoofSurfaceAt);   // sound.ts bind: the call table + the synth bed
 *   steppeVoices(audio).thunder(distance, pan)                         // weather.ts: the same instance per mixer
 */

/** the bed id this profile's synth bed answers to (`audio.setAmbient(STEPPE_BED)`) */
export const STEPPE_BED = requireAudioProfile(source.audio.samples, 'nalati.samples').bed;
/** the steppe bed's live levels (sound.ts, ~4 Hz) */
export interface SteppeLevels { wind: number; gust: number; river: number; waterfall: number; camp: number; night: number }
/** the steppe's creature calls (Wildlife / Flock / Marmots / Pack / Herd and the elites) */
export type SteppeCall = 'wolf_howl' | 'wolf_snarl' | 'wolf_bite' | 'wolf_yip' | 'wolf_yelp' | 'horse_neigh' | 'horse_snort' | 'horse_squeal'
  | 'dog_bark' | 'dog_yelp' | 'sheep_bleat' | 'marmot_whistle' | 'eagle_cry' | 'leopard_growl';
/** the set's one-shots this file plays (sfx.json families) */
export type SteppeShot = `hoof-${HoofSurface}` | 'stampede' | 'bowDraw' | 'bowFullDraw' | 'bowLetDown' | 'bowTwang' | 'arrowWhoosh'
  | `arrowImpact-${ImpactKind}` | 'sabreSwing' | `sabreHit-${'flesh' | 'wood'}` | 'spearThrust' | 'javelinThrow' | `javelinImpact-${ImpactKind}`
  | 'thunder-near' | 'thunder-far' | 'lightningCrackle';

/** the shortest gap (s) between two calls of a kind (crowd AIs can ask many times a second) */
const GAP: Partial<Record<SteppeCall, number>> = {
  wolf_howl: 5, wolf_snarl: 0.6, wolf_yip: 0.5, wolf_yelp: 0.25, horse_neigh: 2.2, horse_snort: 0.7, horse_squeal: 0.9,
  dog_bark: 0.7, dog_yelp: 0.4, sheep_bleat: 0.35, marmot_whistle: 0.9,
};
/** how far a call carries (m) and the distance scale of its fall-off — the engine default is 140 / 9 */
const REACH: Partial<Record<SteppeCall, readonly [number, number]>> = {
  wolf_howl: [700, 60], horse_neigh: [260, 22], dog_bark: [220, 20], marmot_whistle: [180, 16], sheep_bleat: [160, 12], horse_squeal: [200, 18],
  eagle_cry: [420, 34],
};
const CALLS: readonly SteppeCall[] = ['wolf_howl', 'wolf_snarl', 'wolf_bite', 'wolf_yip', 'wolf_yelp', 'horse_neigh', 'horse_snort', 'horse_squeal',
  'dog_bark', 'dog_yelp', 'sheep_bleat', 'marmot_whistle', 'eagle_cry', 'leopard_growl'];

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);
/** one row of the mixer's call table (`audio.registerCalls`) */
type CallVoice = Parameters<Audio['registerCalls']>[0][string];

export class SteppeVoices {
  private storm: { rain: GainNode; hiss: GainNode; roar: GainNode; roarLp: BiquadFilterNode } | undefined;
  /** the sampled storm (SteppeAmbience's rain + storm-wind beds): true = it plays them, the synth storm stays silent */
  stormSink?: ((rain: number, wind: number) => boolean) | undefined;
  private lastHoof = 0;
  private steppeSampled = false;
  private steppe: { grass: GainNode; low: GainNode; mid: GainNode; river: GainNode; fall: GainNode; stove: GainNode } | undefined;
  private steppeLv: SteppeLevels = { wind: 5, gust: 0.3, river: 0, waterfall: 0, camp: 0, night: 0 };
  /** the bed's schedulers (larks, crickets, the stove's crackle): disposed when the bed stops */
  private bedScope: Scope | undefined;
  private timers(): Scope { this.bedScope ??= new Scope('audio.steppe.bed'); return this.bedScope; }

  constructor(private readonly a: Audio) {}

  /** the call table the mixer's `animal()` reads: reach / gap per call, the synth after the sampled take */
  callTable(hoofSurfaceAt: (x: number, z: number) => HoofSurface): Record<string, CallVoice> {
    const table: Record<string, CallVoice> = {};
    for (const kind of CALLS) {
      const reach = REACH[kind], gap = GAP[kind];
      table[kind] = { ...(reach ? { reach } : {}), ...(gap !== undefined ? { gap } : {}), play: (t, bus) => { this.call(kind, t, bus); } };
    }
    // the hooves are this file's own: the set's 'hoofsteps' take must not take them over (one sampled take per ground)
    table['hoofsteps'] = { sampled: false, play: (t, bus, at) => { this.hooves(hoofSurfaceAt(at.position.x, at.position.z), t, bus, at.dist); } };
    return table;
  }

  private call(kind: SteppeCall, t: number, bus: GainNode): void {
    const a = this.a;
    switch (kind) {
      case 'eagle_cry': { // Qyran: a golden eagle's thin high "kee-yeer" — a whistle that climbs, frays and falls, twice
        const n = 1 + Math.floor(rnd(0, 1.7));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.42, 0.55), top = rnd(2300, 2700);
          a.tone({ t: ti, type: 'sine', f0: top * 0.8, f1: top, glide: 0.06, gain: 0.5, attack: 0.02, hold: 0.08, decay: 0.05, vibrato: { rate: 34, depth: 60 }, out: bus });
          a.tone({ t: ti + 0.14, type: 'sawtooth', f0: top, f1: top * 0.62, glide: 0.3, gain: 0.22, attack: 0.01, decay: 0.32, vibrato: { rate: 40, depth: 90 }, lowpass: 5200, out: bus });
          a.burst({ t: ti, type: 'bandpass', freq: top * 1.4, q: 2.2, gain: 0.08, attack: 0.02, hold: 0.1, decay: 0.3, out: bus });
        }
        break;
      }
      case 'leopard_growl': { // Aqbars: a snow leopard's rasping hiss-growl — a dry sawing rumble, higher and thinner than a bear's, a spit of breath on top
        const dur = rnd(0.55, 0.8);
        a.tone({ t, type: 'sawtooth', f0: rnd(88, 104), f1: 70, glide: dur, gain: 0.6, attack: 0.04, hold: dur * 0.5, decay: dur * 0.45, vibrato: { rate: 24, depth: 12 }, lowpass: 700, out: bus });
        a.burst({ t, type: 'bandpass', freq: 3200, freqEnd: 1800, q: 0.7, gain: 0.3, attack: 0.02, hold: dur * 0.3, decay: dur * 0.5, out: bus });
        a.burst({ t, type: 'lowpass', freq: 600, gain: 0.35, attack: 0.03, hold: dur * 0.4, decay: dur * 0.5, rate: 0.8, out: bus });
        break;
      }
      case 'wolf_howl': { // a long rising-holding-falling howl; one or two of the pack join in, a little later, higher or lower
        const voices = 1 + Math.floor(rnd(0, 2.6));
        for (let v = 0; v < voices; v++) {
          const tv = t + (v === 0 ? 0 : rnd(0.5, 1.6)), k = v === 0 ? 1 : rnd(0.82, 1.22);
          const rise = rnd(0.45, 0.7), hold = rnd(0.9, 1.5), fall = rnd(0.7, 1.1), top = rnd(560, 700) * k;
          const g = v === 0 ? 0.55 : 0.3;
          a.tone({ t: tv, type: 'sine', f0: top * 0.55, f1: top, glide: rise, gain: g, attack: 0.25, hold: rise + hold - 0.25, decay: 0.08, vibrato: { rate: 5, depth: 9 }, out: bus });
          a.tone({ t: tv + rise + hold, type: 'sine', f0: top, f1: top * 0.62, glide: fall, gain: g, attack: 0.02, decay: fall, vibrato: { rate: 5, depth: 7 }, out: bus });
          a.tone({ t: tv, type: 'triangle', f0: top * 1.1, f1: top * 2, glide: rise, gain: g * 0.12, attack: 0.3, hold: rise + hold - 0.3, decay: fall * 0.6, lowpass: 3000, out: bus });
          a.burst({ t: tv, type: 'bandpass', freq: top * 1.4, q: 3, gain: g * 0.12, attack: 0.3, hold: rise + hold, decay: fall, out: bus });
        }
        break;
      }
      case 'wolf_snarl': { // a rattling growl through bared teeth
        const dur = rnd(0.5, 0.8);
        a.tone({ t, type: 'sawtooth', f0: rnd(105, 125), f1: 90, glide: dur, gain: 0.6, attack: 0.04, hold: dur * 0.6, decay: dur * 0.4, vibrato: { rate: 34, depth: 22 }, lowpass: 900, out: bus });
        a.burst({ t, type: 'bandpass', freq: 700, q: 1.1, gain: 0.35, attack: 0.03, hold: dur * 0.6, decay: dur * 0.4, out: bus });
        a.burst({ t: t + dur * 0.3, type: 'highpass', freq: 2600, gain: 0.08, attack: 0.05, hold: dur * 0.3, decay: 0.2, out: bus });
        break;
      }
      case 'wolf_bite': { // jaws snapping shut: a hard click, a thump, a clipped growl
        a.burst({ t, type: 'highpass', freq: 2200, gain: 0.7, decay: 0.035, out: bus });
        a.burst({ t: t + 0.012, type: 'bandpass', freq: 1200, q: 1.5, gain: 0.4, decay: 0.05, out: bus });
        a.tone({ t, type: 'sine', f0: 140, f1: 70, glide: 0.06, gain: 0.5, decay: 0.09, out: bus });
        a.tone({ t: t + 0.05, type: 'sawtooth', f0: 120, f1: 95, glide: 0.2, gain: 0.35, attack: 0.02, decay: 0.22, vibrato: { rate: 30, depth: 18 }, lowpass: 800, out: bus });
        break;
      }
      case 'wolf_yip': { // the scout's short excited yips
        const n = 2 + Math.floor(rnd(0, 2));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.14, 0.2), f = rnd(900, 1150);
          a.tone({ t: ti, type: 'sawtooth', f0: f * 0.8, f1: f * 1.3, glide: 0.05, gain: 0.35, attack: 0.008, hold: 0.03, decay: 0.07, lowpass: 3200, out: bus });
          a.tone({ t: ti, type: 'sine', f0: f, f1: f * 1.2, glide: 0.06, gain: 0.3, attack: 0.008, decay: 0.09, out: bus });
        }
        break;
      }
      case 'wolf_yelp': case 'dog_yelp': { // hurt: a sharp high cry sliding down, then a whimper
        const f = kind === 'dog_yelp' ? 1400 : 1150;
        a.tone({ t, type: 'sawtooth', f0: f, f1: f * 0.5, glide: 0.32, gain: 0.55, attack: 0.01, hold: 0.04, decay: 0.3, vibrato: { rate: 26, depth: 40 }, lowpass: 3600, out: bus });
        a.tone({ t: t + 0.36, type: 'sine', f0: f * 0.7, f1: f * 0.55, glide: 0.25, gain: 0.22, attack: 0.02, decay: 0.25, vibrato: { rate: 12, depth: 20 }, out: bus });
        break;
      }
      case 'horse_neigh': { // the whinny: a high quavering cry falling in steps, then a nicker through the nose
        const dur = rnd(1.0, 1.35), top = rnd(950, 1150);
        a.tone({ t, type: 'sawtooth', f0: top * 0.8, f1: top, glide: 0.12, gain: 0.5, attack: 0.04, hold: 0.12, decay: 0.05, vibrato: { rate: 17, depth: 110 }, lowpass: 3800, out: bus });
        a.tone({ t: t + 0.2, type: 'sawtooth', f0: top, f1: top * 0.45, glide: dur, gain: 0.45, attack: 0.02, hold: dur * 0.5, decay: dur * 0.5, vibrato: { rate: 15, depth: 90 }, lowpass: 3000, out: bus });
        a.burst({ t, type: 'bandpass', freq: 2200, q: 0.8, gain: 0.14, attack: 0.05, hold: dur * 0.6, decay: dur * 0.4, out: bus });
        const tn = t + 0.2 + dur;
        for (let i = 0; i < 4; i++) a.tone({ t: tn + i * 0.07, type: 'sawtooth', f0: 170, f1: 140, glide: 0.06, gain: 0.25, attack: 0.01, decay: 0.06, lowpass: 900, out: bus });
        a.burst({ t: tn, type: 'lowpass', freq: 700, gain: 0.25, attack: 0.02, hold: 0.2, decay: 0.15, out: bus });
        break;
      }
      case 'horse_snort': { // a blast of air through flapping nostrils
        for (let i = 0; i < 5; i++) a.burst({ t: t + i * 0.028, type: 'bandpass', freq: rnd(450, 700), q: 0.9, gain: 0.5 * (1 - i * 0.12), attack: 0.004, decay: 0.05, out: bus });
        a.burst({ t, type: 'lowpass', freq: 1400, gain: 0.35, attack: 0.02, hold: 0.12, decay: 0.2, out: bus });
        break;
      }
      case 'horse_squeal': { // a stallion's shrill squeal (the kick, the fight)
        a.tone({ t, type: 'sawtooth', f0: 1300, f1: 1700, glide: 0.1, gain: 0.55, attack: 0.02, hold: 0.25, decay: 0.3, vibrato: { rate: 24, depth: 90 }, lowpass: 4200, out: bus });
        a.tone({ t, type: 'square', f0: 650, f1: 820, glide: 0.1, gain: 0.15, attack: 0.02, hold: 0.25, decay: 0.3, lowpass: 2000, out: bus });
        a.burst({ t, type: 'bandpass', freq: 2600, q: 1, gain: 0.2, attack: 0.02, hold: 0.25, decay: 0.3, out: bus });
        break;
      }
      case 'dog_bark': { // one to three chesty barks
        const n = 1 + Math.floor(rnd(0, 2.8));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.22, 0.32), f = rnd(420, 520);
          a.tone({ t: ti, type: 'sawtooth', f0: f, f1: f * 0.6, glide: 0.1, gain: 0.55, attack: 0.008, hold: 0.03, decay: 0.1, lowpass: 2000, out: bus });
          a.burst({ t: ti, type: 'bandpass', freq: 900, q: 0.8, gain: 0.4, attack: 0.005, hold: 0.02, decay: 0.09, out: bus });
        }
        break;
      }
      case 'sheep_bleat': { // "baa": a nasal tremolo, the voice wobbling
        const dur = rnd(0.5, 0.85), f = rnd(300, 460);
        const bleat = a.ctx.createGain(); bleat.gain.value = 1;
        const lfo = ownAudioSource(a.ctx.createOscillator()); lfo.frequency.value = rnd(6.5, 8.5);
        const lg = a.ctx.createGain(); lg.gain.value = 0.6;
        lfo.connect(lg).connect(bleat.gain); lfo.start(t); lfo.stop(t + dur + 0.2);
        const form = a.ctx.createBiquadFilter(); form.type = 'bandpass'; form.frequency.value = rnd(1000, 1300); form.Q.value = 1.2;
        bleat.connect(form).connect(bus);
        a.tone({ t, type: 'sawtooth', f0: f * 1.08, f1: f * 0.92, glide: dur, gain: 0.8, attack: 0.05, hold: dur * 0.6, decay: dur * 0.4, out: bleat });
        a.tone({ t, type: 'sawtooth', f0: f * 1.08, f1: f * 0.92, glide: dur, gain: 0.2, attack: 0.05, hold: dur * 0.6, decay: dur * 0.4, lowpass: 900, out: bus });
        break;
      }
      case 'marmot_whistle': { // the sentry's piercing alarm whistle, once or twice
        const n = 1 + Math.floor(rnd(0, 1.7));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.3, 0.45), f = rnd(2700, 3100);
          a.tone({ t: ti, type: 'sine', f0: f * 1.04, f1: f * 0.94, glide: 0.18, gain: 0.45, attack: 0.01, hold: 0.1, decay: 0.12, out: bus });
          a.tone({ t: ti, type: 'sine', f0: f * 2.08, f1: f * 1.88, glide: 0.18, gain: 0.06, attack: 0.01, hold: 0.1, decay: 0.1, out: bus });
        }
        break;
      }
      default: break; // every SteppeCall has a case above
    }
  }

  // ─────────────── weather (the storms) ───────────────
  /** the storm beds: `rain` 0..1 (a close patter + a wide hiss), `wind` 0..1 (a low roar, brighter as it rises). Built on first use. */
  setStorm(rainIn: number, windIn: number): void {
    const a = this.a;
    if (!a.ready) return; // before the first gesture: nothing can play
    const sunk = this.stormSink?.(rainIn, windIn) === true;
    if (sunk && !this.storm) return;
    const rain = sunk ? 0 : rainIn, wind = sunk ? 0 : windIn;
    if (!this.storm) {
      if (rain <= 0.001 && wind <= 0.001) return;
      const c = a.ctx;
      const loop = (type: BiquadFilterType, freq: number, q: number): { src: AudioBufferSourceNode; out: GainNode } => {
        const src = ownAudioSource(c.createBufferSource()); src.buffer = a.noise; src.loop = true; src.playbackRate.value = rnd(0.9, 1.1); src.start(0, audioRandom() * 1.5);
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(a.ambient);
        return { src, out: g };
      };
      const rainL = loop('highpass', 2600, 0.4);
      const hissL = loop('bandpass', 7000, 0.35);
      const roarL = loop('lowpass', 260, 0.7);
      const roarLp = c.createBiquadFilter(); roarLp.type = 'lowpass'; roarLp.frequency.value = 500;
      roarL.out.disconnect(); roarL.out.connect(roarLp).connect(a.ambient);
      // the roar breathes: a slow LFO on its gain
      const lfo = ownAudioSource(c.createOscillator()); lfo.frequency.value = 0.13; const lg = c.createGain(); lg.gain.value = 0.25;
      lfo.connect(lg).connect(roarL.out.gain); lfo.start();
      this.storm = { rain: rainL.out, hiss: hissL.out, roar: roarL.out, roarLp };
    }
    const t = a.ctx.currentTime, S = this.storm;
    S.rain.gain.setTargetAtTime(0.32 * rain, t, 0.8);
    S.hiss.gain.setTargetAtTime(0.1 * rain, t, 0.8);
    S.roar.gain.setTargetAtTime(0.55 * wind, t, 1.2);
    S.roarLp.frequency.setTargetAtTime(380 + 900 * wind, t, 1.2);
  }

  /** a thunderclap `distance` m away (delayed by the speed of sound): near = a crack + a rolling rumble; far = a low roll */
  thunder(distance: number, pan = 0): void {
    tap.sound?.('thunder');
    const a = this.a;
    if (!a.ready) return;
    a.tally('thunder');
    const c = a.ctx, delay = Math.min(12, distance / 343), t = c.currentTime + delay;
    const near = Math.max(0, 1 - distance / 900), level = 0.25 + 0.75 * near;
    // sampled: the close crack under ~400 m, the far roll past it, darker with distance (a per-call low-pass)
    if (a.hasShot(distance < 400 ? 'thunder-near' : 'thunder-far')) {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000 / (1 + distance / 300);
      a.route(lp, pan * 0.6);
      if (a.shot(distance < 400 ? 'thunder-near' : 'thunder-far', { out: lp, t, gain: 0.5 + 0.7 * near })) return;
    }
    if (distance < 400) {
      // the crack: a bright broadband tear, then a snapping tail
      a.burst({ t, type: 'highpass', freq: 900, q: 0.3, gain: 0.9 * near, attack: 0.004, decay: 0.35, pan });
      a.burst({ t: t + 0.03, type: 'bandpass', freq: 2400, freqEnd: 500, q: 0.5, gain: 0.5 * near, attack: 0.01, decay: 0.8, pan });
    }
    // the rumble: several low noise rolls, overlapping, each a little later and lower
    const rolls = 3 + Math.floor(rnd(0, 3));
    for (let i = 0; i < rolls; i++) {
      const at = t + i * rnd(0.25, 0.7) + (distance > 400 ? rnd(0, 0.4) : 0.05);
      a.burst({ t: at, type: 'lowpass', freq: 160 + 220 * near * rnd(0.6, 1), q: 0.8, gain: level * rnd(0.35, 0.6), attack: rnd(0.05, 0.25), hold: rnd(0.1, 0.5), decay: rnd(1.4, 3.2), pan: pan * 0.6, rate: rnd(0.5, 0.8) });
    }
  }

  /** the static crackle before a strike (1.2 s of dry snaps, rising) */
  lightningCrackle(pan = 0, gain = 1): void {
    tap.sound?.('lightningCrackle');
    const a = this.a;
    if (!a.ready) return;
    a.tally('lightningCrackle');
    if (a.shot('lightningCrackle', { pan, gain })) return;
    const t0 = a.ctx.currentTime;
    for (let i = 0; i < 26; i++) {
      const k = i / 26, t = t0 + k * 1.15 + rnd(0, 0.03);
      a.burst({ t, type: 'bandpass', freq: rnd(2500, 7000), q: 2, gain: gain * (0.05 + 0.2 * k * k) * rnd(0.5, 1), attack: 0.001, decay: rnd(0.01, 0.04), pan });
    }
    a.burst({ t: t0, type: 'bandpass', freq: 5200, q: 1.2, gain: 0.05 * gain, attack: 1.0, decay: 0.15, pan });
  }

  // ─────────────── hooves, the stampede, the steppe weapons ───────────────
  /** one footfall (a hoof pair) on the given ground, into `bus`; a herd's many footfalls are thinned with distance */
  private hooves(surf: HoofSurface, t: number, bus: AudioNode, dist = 0): void {
    const a = this.a;
    // a herd galloping past fires dozens of footfalls a second: keep ~18 / s near, fewer far off
    if (t - this.lastHoof < 0.055 * (1 + dist / 20)) return;
    this.lastHoof = t;
    if (a.shot(`hoof-${surf}`, { out: bus, t, gain: 0.8 })) return; // one sampled take is the whole pair
    for (const b of [0, rnd(0.03, 0.06)]) {
      const ti = t + b;
      if (surf === 'wood') { // the bridge deck: a hollow knock
        a.tone({ t: ti, type: 'triangle', f0: rnd(170, 210), f1: 120, glide: 0.06, gain: 0.45, decay: 0.1, out: bus });
        a.burst({ t: ti, type: 'bandpass', freq: 900, q: 2, gain: 0.35, decay: 0.05, out: bus });
      } else if (surf === 'gravel') { // stones: a crunch over the thud
        a.burst({ t: ti, type: 'bandpass', freq: rnd(1800, 2600), q: 0.7, gain: 0.3, decay: rnd(0.05, 0.08), out: bus });
        a.tone({ t: ti, type: 'sine', f0: rnd(70, 85), f1: 45, glide: 0.04, gain: 0.3, decay: 0.07, out: bus });
      } else { // turf: soft, low, a swish of grass
        a.tone({ t: ti, type: 'sine', f0: rnd(55, 70), f1: 38, glide: 0.05, gain: 0.35, decay: 0.08, out: bus });
        a.burst({ t: ti, type: 'lowpass', freq: rnd(180, 260), gain: 0.35, decay: 0.07, out: bus });
        a.burst({ t: ti, type: 'bandpass', freq: 3200, q: 0.6, gain: 0.05, decay: 0.08, out: bus });
      }
    }
  }

  /** a herd stampeding `distance` m away: a rolling ground rumble under a scatter of hooves (~3.5 s) */
  stampede(distance: number, pan = 0): void {
    tap.sound?.('stampede');
    const a = this.a;
    if (!a.ready || distance > 400) return;
    a.tally('stampede');
    const t = a.ctx.currentTime, k = 1 / (1 + distance / 30);
    const bus = a.ctx.createGain(); bus.gain.value = k;
    const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000 / (1 + distance / 40);
    bus.connect(lp); a.route(lp, pan * 0.7);
    if (a.shot('stampede', { out: bus })) return;
    a.burst({ t, type: 'lowpass', freq: 110, q: 0.7, gain: 0.9, attack: 0.6, hold: 2.2, decay: 1.4, out: bus, rate: 0.6 });
    a.burst({ t, type: 'bandpass', freq: 260, q: 0.6, gain: 0.35, attack: 0.5, hold: 2, decay: 1.2, out: bus });
    for (let i = 0; i < 40; i++) { this.lastHoof = 0; this.hooves(audioRandom() < 0.8 ? 'grass' : 'gravel', t + rnd(0, 3.2), bus); }
  }

  /** the recurve's release: the string's twang and the limbs' thump, brighter at full draw (power 0..1) */
  bowTwang(power = 1): void {
    tap.sound?.('bowTwang');
    const a = this.a;
    if (!a.ready) return;
    a.tally('bowTwang');
    const t = a.ctx.currentTime, p = Math.max(0.2, Math.min(1, power));
    if (a.shot('bowTwang', { gain: 0.55 + 0.45 * p, rate: 0.94 + 0.08 * p })) { this.arrowWhoosh(p); return; }
    a.tone({ t, type: 'triangle', f0: 150 + 40 * p, f1: 118, glide: 0.18, gain: 0.35 + 0.3 * p, attack: 0.002, decay: 0.28, vibrato: { rate: 38, depth: 6 } });
    a.tone({ t, type: 'sawtooth', f0: 300 + 80 * p, f1: 240, glide: 0.1, gain: 0.12 + 0.1 * p, attack: 0.002, decay: 0.14, lowpass: 1800 });
    a.burst({ t, type: 'highpass', freq: 2500, gain: 0.3 * p, decay: 0.02 });
    a.burst({ t, type: 'lowpass', freq: 260, gain: 0.4 * p, decay: 0.08 });
    this.arrowWhoosh(p);
  }

  /** an arrow leaving the bow: a fast rising-falling air rip */
  arrowWhoosh(power = 1): void {
    tap.sound?.('arrowWhoosh');
    const a = this.a;
    if (!a.ready) return;
    a.tally('arrowWhoosh');
    if (a.shot('arrowWhoosh', { gain: 0.35 + 0.35 * power })) return;
    const t = a.ctx.currentTime;
    a.burst({ t: t + 0.01, type: 'bandpass', freq: 2600, freqEnd: 700, q: 1.4, gain: 0.12 + 0.12 * power, attack: 0.02, decay: 0.22 });
  }

  /** the bow drawn (Bow.onDrawStart — H4's hold-to-draw): the limbs' creak and the string stretching */
  bowDraw(): void {
    tap.sound?.('bowDraw');
    const a = this.a;
    if (!a.ready) return;
    a.tally('bowDraw');
    if (a.shot('bowDraw', { gain: 0.7 })) return;
    const t = a.ctx.currentTime;
    a.tone({ t, type: 'sawtooth', f0: rnd(95, 115), f1: rnd(130, 150), glide: 0.7, gain: 0.05, attack: 0.15, hold: 0.4, decay: 0.25, vibrato: { rate: 23, depth: 14 }, lowpass: 1100 });
    a.burst({ t, type: 'bandpass', freq: 1300, freqEnd: 2100, q: 3, gain: 0.04, attack: 0.2, hold: 0.35, decay: 0.2 });
  }

  /** full draw reached (Bow.onFullDraw): one tight creak and the nock's click */
  bowFullDraw(): void {
    tap.sound?.('bowFullDraw');
    const a = this.a;
    if (!a.ready) return;
    a.tally('bowFullDraw');
    if (a.shot('bowFullDraw', { gain: 0.6 })) return;
    const t = a.ctx.currentTime;
    a.burst({ t, type: 'highpass', freq: 3200, gain: 0.12, decay: 0.012 });
    a.tone({ t: t + 0.01, type: 'sawtooth', f0: 150, f1: 138, glide: 0.1, gain: 0.04, attack: 0.01, decay: 0.12, vibrato: { rate: 30, depth: 10 }, lowpass: 1400 });
  }

  /** the draw eased back without a shot (Bow.onLetDown: an early release, or the arm tiring) */
  bowLetDown(): void {
    tap.sound?.('bowLetDown');
    const a = this.a;
    if (!a.ready) return;
    a.tally('bowLetDown');
    if (a.shot('bowLetDown', { gain: 0.6 })) return;
    const t = a.ctx.currentTime;
    a.tone({ t, type: 'sawtooth', f0: rnd(140, 150), f1: rnd(95, 105), glide: 0.45, gain: 0.04, attack: 0.05, hold: 0.15, decay: 0.3, vibrato: { rate: 21, depth: 12 }, lowpass: 1000 });
    a.burst({ t: t + 0.35, type: 'bandpass', freq: 2400, q: 2, gain: 0.03, decay: 0.05 });
  }

  /** an arrow striking: the shaft's quiver in wood, a dull thump in the turf, a wet thud in flesh */
  arrowImpact(kind: ImpactKind, pan = 0, gain = 1): void {
    tap.sound?.(`arrowImpact:${kind}`);
    const a = this.a;
    if (!a.ready) return;
    a.tally(`arrowImpact:${kind}`);
    if (a.shot(`arrowImpact-${kind}`, { pan, gain })) return;
    const t = a.ctx.currentTime;
    if (kind === 'wood') {
      a.burst({ t, type: 'bandpass', freq: 1500, q: 1.8, gain: 0.55 * gain, decay: 0.05, pan });
      a.tone({ t, type: 'triangle', f0: 95, f1: 88, glide: 0.35, gain: 0.3 * gain, attack: 0.003, decay: 0.35, vibrato: { rate: 24, depth: 9 }, pan });
    } else if (kind === 'flesh') {
      a.burst({ t, type: 'lowpass', freq: 600, gain: 0.7 * gain, decay: 0.08, pan });
      a.tone({ t, type: 'sine', f0: 110, f1: 60, glide: 0.06, gain: 0.45 * gain, decay: 0.1, pan });
    } else {
      a.burst({ t, type: 'lowpass', freq: 380, gain: 0.5 * gain, decay: 0.07, pan });
      a.burst({ t, type: 'bandpass', freq: 2400, q: 0.8, gain: 0.08 * gain, decay: 0.08, pan });
    }
  }

  /** a javelin thrown: a grunt of effort and a long heavy whoosh */
  javelinThrow(): void {
    tap.sound?.('javelinThrow');
    const a = this.a;
    if (!a.ready) return;
    a.tally('javelinThrow');
    if (a.shot('javelinThrow')) return;
    const t = a.ctx.currentTime;
    a.burst({ t, type: 'bandpass', freq: 1400, freqEnd: 300, q: 1, gain: 0.3, attack: 0.04, decay: 0.45 });
    a.burst({ t, type: 'lowpass', freq: 500, gain: 0.2, attack: 0.02, decay: 0.12 });
    a.tone({ t, type: 'sawtooth', f0: 150, f1: 110, glide: 0.12, gain: 0.08, attack: 0.02, decay: 0.12, lowpass: 700 });
  }

  /** a javelin landing: heavier than an arrow — a deep thump, the shaft ringing in wood */
  javelinImpact(kind: ImpactKind, pan = 0, gain = 1): void {
    tap.sound?.(`javelinImpact:${kind}`);
    const a = this.a;
    if (!a.ready) return;
    a.tally(`javelinImpact:${kind}`);
    if (a.shot(`javelinImpact-${kind}`, { pan, gain })) return;
    const t = a.ctx.currentTime;
    a.tone({ t, type: 'sine', f0: 120, f1: 48, glide: 0.08, gain: 0.6 * gain, decay: 0.14, pan });
    a.burst({ t, type: 'lowpass', freq: kind === 'flesh' ? 500 : 700, gain: 0.55 * gain, decay: 0.1, pan });
    if (kind === 'wood') a.tone({ t, type: 'triangle', f0: 70, f1: 64, glide: 0.5, gain: 0.3 * gain, decay: 0.5, vibrato: { rate: 18, depth: 6 }, pan });
    else if (kind === 'ground') a.burst({ t: t + 0.02, type: 'bandpass', freq: 1800, q: 0.7, gain: 0.12 * gain, decay: 0.12, pan });
  }

  /** the sabre's cut: a thin fast swish and the steel's ring */
  sabreSwing(): void {
    tap.sound?.('sabreSwing');
    const a = this.a;
    if (!a.ready) return;
    a.tally('sabreSwing');
    if (a.shot('sabreSwing')) return;
    const t = a.ctx.currentTime;
    a.burst({ t, type: 'bandpass', freq: 1800, freqEnd: 4200, q: 1.4, gain: 0.28, attack: 0.03, decay: 0.16 });
    this.steelRing(t + 0.02, 0.045);
  }

  /** the sabre biting: the sword's hit + the blade ringing on */
  sabreHit(kind: ImpactKind, pan = 0, gain = 1): void {
    tap.sound?.(`sabreHit:${kind}`);
    const a = this.a;
    if (!a.ready) return;
    a.tally(`sabreHit:${kind}`);
    if (kind !== 'ground' && a.shot(`sabreHit-${kind}`, { pan, gain })) return;
    sharedWeaponVoices(a).swordHit(kind, pan, gain);
    this.steelRing(a.ctx.currentTime, 0.07 * gain, pan);
  }

  /** a thin inharmonic steel ring (three partials, a slow beat between the upper two) */
  private steelRing(t: number, gain: number, pan = 0): void {
    for (const [f, g, d] of [[2380, 1, 0.9], [3710, 0.6, 0.7], [5160, 0.35, 0.5], [5190, 0.3, 0.5]] as const) {
      this.a.tone({ t, type: 'sine', f0: f * rnd(0.99, 1.01), gain: gain * g, attack: 0.003, decay: d, pan });
    }
  }

  /** the spear's thrust: a short upward rip of air and the shaft's creak */
  spearThrust(): void {
    tap.sound?.('spearThrust');
    const a = this.a;
    if (!a.ready) return;
    a.tally('spearThrust');
    if (a.shot('spearThrust')) return;
    const t = a.ctx.currentTime;
    a.burst({ t, type: 'bandpass', freq: 900, freqEnd: 2600, q: 1.2, gain: 0.3, attack: 0.02, decay: 0.14 });
    a.tone({ t, type: 'triangle', f0: 230, f1: 190, glide: 0.08, gain: 0.07, attack: 0.01, decay: 0.08 });
  }

  // ─────────────── the synth steppe bed ───────────────
  /** the zoned sample beds are playing (SteppeAmbience): the synth steppe bed stops — false brings it back (the synth
   *  set, or no bed decoded) */
  sampledSteppe(on: boolean): void {
    if (on === this.steppeSampled) return;
    this.steppeSampled = on;
    this.a.restartSynthBed(STEPPE_BED);
  }

  /** the steppe's live levels (sound.ts, a few times a second) — only the steppe bed listens */
  setSteppe(lv: SteppeLevels): void {
    this.steppeLv = lv;
    const S = this.steppe, a = this.a;
    if (!S || !a.ready) return;
    const t = a.ctx.currentTime, w = Math.min(1, lv.wind / 14), g = Math.min(1, lv.gust);
    // the grass hiss rises with the gust fronts rolling through; the low wind with the base speed
    S.grass.gain.setTargetAtTime(0.012 + 0.05 * w + 0.07 * g * (0.4 + w), t, 0.35);
    S.low.gain.setTargetAtTime(0.04 + 0.1 * w + 0.05 * g, t, 0.8);
    S.mid.gain.setTargetAtTime(0.015 + 0.05 * w * g, t, 0.5);
    S.river.gain.setTargetAtTime(0.16 * lv.river, t, 0.6);
    S.fall.gain.setTargetAtTime(0.3 * lv.waterfall, t, 0.6);
    S.stove.gain.setTargetAtTime(0.05 * lv.camp, t, 0.6);
  }

  /** the mixer's synth bed for STEPPE_BED (no sampled bed of that id): the synth grass bed, or only the stove's crackle
   *  under the sampled zone beds when the set has no camp bed */
  readonly bed = {
    start: (): void => { if (!this.steppeSampled) this.startSteppe(); else if (!this.a.loop('camp')) this.scheduleCrackle(); },
    stop: (): void => { this.bedScope?.dispose(); this.bedScope = undefined; this.steppe = undefined; },
  };

  /** the grassland: wind in the grass (driven by setSteppe), the river, the camp stove; larks by day, crickets at night */
  private startSteppe(): void {
    tap.sound?.('audio.startSteppe');
    const a = this.a;
    const grass = a.mkWind(3600, 0.35, 0.15, 0.13, 0.02, 8000);   // the blades' hiss
    const low = a.mkWind(200, 0.5, -0.35, 0.05, 0.06, 800);       // the wind itself
    const mid = a.mkWind(700, 0.8, 0.4, 0.09, 0.02, 1800);        // gusts whistling
    const c = a.ctx;
    const loop = (type: BiquadFilterType, freq: number, q: number, lp: number): GainNode => {
      const src = ownAudioSource(c.createBufferSource()); src.buffer = a.noise; src.loop = true; src.playbackRate.value = rnd(0.8, 1.1); src.start(0, audioRandom() * 1.5);
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f).connect(l).connect(g).connect(a.ambient);
      a.ownBedNodes(g, src);
      return g;
    };
    const river = loop('bandpass', 900, 0.5, 4000);     // the Kunes over its gravel: a broad rushing band
    const fall = loop('lowpass', 500, 0.7, 700);         // the waterfall's roar
    const stove = loop('lowpass', 160, 0.9, 300);        // the stove's low draw
    this.steppe = { grass, low, mid, river, fall, stove };
    this.setSteppe(this.steppeLv);
    this.scheduleLark(); this.scheduleCricket(); this.scheduleCrackle();
  }

  private scheduleLark(): void {
    const wait = rnd(5, 13) * 1000;
    this.timers().timeout(wait, () => {
      ambientTick('audio.lark', () => {
        if (this.a.ambientOn && this.a.bedId === STEPPE_BED && this.steppeLv.night < 0.4 && this.steppeLv.wind < 16) this.lark();
        this.scheduleLark();
      });
    });
  }

  /** a skylark high up: a long tumbling trill of quick bright notes */
  private lark(): void {
    const a = this.a, c = a.ctx, t0 = c.currentTime, pan = rnd(-0.8, 0.8);
    const bus = c.createGain(); bus.gain.value = rnd(0.05, 0.09);
    a.route(bus, pan, a.ambient);
    let t = t0;
    const n = 10 + Math.floor(rnd(0, 18)), base = rnd(3200, 4400);
    for (let i = 0; i < n; i++) {
      const f = base * rnd(0.8, 1.25), d = rnd(0.03, 0.07);
      a.tone({ t, type: 'sine', f0: f, f1: f * rnd(0.85, 1.2), glide: d, gain: 1, attack: 0.006, decay: d, vibrato: { rate: rnd(40, 80), depth: rnd(60, 200) }, out: bus });
      t += d + rnd(0.01, 0.05);
    }
  }

  private scheduleCricket(): void {
    const wait = rnd(0.25, 0.9) * 1000;
    this.timers().timeout(wait, () => {
      ambientTick('audio.cricket', () => {
        const nl = this.steppeLv.night;
        if (this.a.ambientOn && this.a.bedId === STEPPE_BED && nl > 0.3) this.cricket(nl);
        this.scheduleCricket();
      });
    });
  }

  /** a cricket's chirp: three or four quick pulses of a high sine */
  private cricket(level: number): void {
    const a = this.a, c = a.ctx, t0 = c.currentTime, f = rnd(4200, 4900);
    const bus = c.createGain(); bus.gain.value = 0.02 * level * rnd(0.5, 1);
    a.route(bus, rnd(-0.9, 0.9), a.ambient);
    const n = 3 + Math.floor(rnd(0, 2));
    for (let i = 0; i < n; i++) a.tone({ t: t0 + i * 0.045, type: 'sine', f0: f, gain: 1, attack: 0.004, decay: 0.025, out: bus });
  }

  private scheduleCrackle(): void {
    const wait = rnd(0.04, 0.35) * 1000;
    this.timers().timeout(wait, () => {
      ambientTick('audio.crackle', () => {
        const k = this.steppeLv.camp, a = this.a;
        if (a.ambientOn && a.bedId === STEPPE_BED && k > 0.03) {
          const t = a.ctx.currentTime;
          a.burst({ t, type: 'highpass', freq: rnd(1500, 3500), gain: rnd(0.02, 0.09) * k, decay: rnd(0.006, 0.025), pan: rnd(-0.3, 0.3), out: a.ambient });
          if (audioRandom() < 0.08) a.burst({ t: t + 0.01, type: 'bandpass', freq: rnd(600, 1100), q: 1.2, gain: 0.12 * k, decay: 0.04, out: a.ambient }); // a knot pops
        }
        this.scheduleCrackle();
      });
    });
  }
}

const byMixer = new WeakMap<Audio, SteppeVoices>();
/** the one SteppeVoices of a mixer (weather.ts and SteppeAmbience reach the instance sound.ts installed) */
export function steppeVoices(audio: Audio): SteppeVoices {
  let v = byMixer.get(audio);
  if (!v) { v = new SteppeVoices(audio); byMixer.set(audio, v); }
  return v;
}
/** registers the steppe's call table and synth bed on the mixer for the life of `scope` */
export function installSteppeVoices(audio: Audio, scope: Scope, hoofSurfaceAt: (x: number, z: number) => HoofSurface): SteppeVoices {
  const v = steppeVoices(audio);
  audio.registerCalls(v.callTable(hoofSurfaceAt), scope);
  audio.installSynthBed(STEPPE_BED, v.bed, scope);
  return v;
}
