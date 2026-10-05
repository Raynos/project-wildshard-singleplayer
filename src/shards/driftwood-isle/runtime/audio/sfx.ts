import { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { impact } from '@wildshard/engine/audio/gen';
import { audioRandom, panFromYaw } from '@wildshard/engine/audio/util';
import type { VoiceTable } from '@wildshard/engine/audio/Voices';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import type { Vector3 } from 'three';
import type { Surface } from './surface';
import { vocal, windup } from './creatureVoices';
/**
 * Driftwood Isle's voice table (08 §6.3 C.2): the island's footsteps (B9) and combat layers (S3), played from the procedural
 * bank (gen.ts via audio.voices), the gull calls, and the island's synth bed (the warm breeze, the far surf hiss, the swells).
 * Every call is a no-op before the first gesture; every bank play has ±5 % pitch jitter and never repeats the variant it
 * played last. Moved verbatim from `src/engine/audio/IslandSfx.ts` and the S3.5 parking `legacyIsland.ts`: the `tap.sound`
 * ids, the envelopes and the RNG draw order are the engine's.
 *
 *   const sfx = new IslandSfx(audio);
 *   sfx.footstep(surfaces.surfaceAt(x, z, y), speed)      // Player.onStep: speed = horizontal m/s (walk 4.3, sprint 7.2)
 *   sfx.whoosh(speed, { heavy, dir })   // a swing: speed 0…1 → pitch + level; heavy = the charged overhead's longer, lower sweep;
 *                                       //   dir −1 / +1 sweeps the pan right→left / left→right
 *   sfx.impact(material, strength, at?) // a hit: contact transient + material body — 'flesh' | 'shell' | 'wood' | 'stone'
 *   sfx.vocal(enemy, at, intensity?)    // 'boar' grunt · 'crab' clack · 'monkey' screech · 'sailor' moan (aggro / hurt barks)
 *   sfx.windup(enemy, at)               // the telegraph, as the wind-up pose starts: 'boar' hoof scrape · 'crab' claw raise · 'sailor' lantern flare
 *   sfx.plunge(up)                      // crossing the water surface (Player.onSubmerge → false, onSurface → true), over audio.dive()/surface()
 *   sfx.interact(sound, at?, o?)        // the adventure kit (S4): 'chest' · 'locked' · 'lever' · 'plate' (o.release) · 'door' · 'grate'
 *                                       //   · 'chime' · 'glyph' · 'ignite'; o.delay / o.gain
 *   sfx.gullCallAt(position, listenerPos, yaw?)   // Gulls.onCall: a squawk with distance attenuation and a pan from the yaw
 *
 *   const bed = new IslandBed(audio);   // the ambience profile installs it: audio.installSynthBed(ISLAND_BED, bed, scope)
 *   bed.zone()                          // the zoned ambience took over the island's beds: the synth bed stops / never starts
 */

export type Material = 'flesh' | 'shell' | 'wood' | 'stone';
export type Enemy = 'boar' | 'crab' | 'monkey' | 'sailor';
export type WindupEnemy = 'boar' | 'crab' | 'sailor';
export type InteractSound = 'chest' | 'locked' | 'lever' | 'plate' | 'door' | 'grate' | 'chime' | 'glyph' | 'ignite';
interface At { x: number; y: number; z: number }

const rnd = (a: number, b: number): number => a + audioRandom() * (b - a);

/** each surface's level at a walk (the bank is peak-normalised; these sit the steps where Audio.footstep's synth ones sat) */
const STEP_LEVEL: Record<Surface, number> = { sand: 0.34, wetSand: 0.36, grass: 0.3, rock: 0.34, planks: 0.42, stone: 0.36, water: 0.34 };
const VOCAL_LEVEL: Record<Enemy, number> = { boar: 0.75, crab: 0.6, monkey: 0.5, sailor: 0.85 };
const WINDUP_LEVEL: Record<WindupEnemy, number> = { boar: 0.7, crab: 0.65, sailor: 0.7 };
const SPRINT = 7.2;
const INTERACT_LEVEL: Record<InteractSound, number> = { chest: 0.7, locked: 0.6, lever: 0.7, plate: 0.65, door: 0.7, grate: 0.6, chime: 0.45, glyph: 0.6, ignite: 0.8 };

/** the families the island plays first — prewarmed right after the first gesture, footsteps before combat */
export const ISLAND_FAMILIES = [
  'step-sand', 'step-planks', 'step-grass', 'step-wetSand', 'step-rock', 'step-water', 'step-stone',
  'whoosh', 'impact-flesh', 'hurt', 'impact-shell', 'impact-wood', 'impact-stone', 'whoosh-heavy',
  'vocal-boar', 'vocal-crab', 'vocal-monkey', 'vocal-sailor', 'windup-boar', 'windup-crab', 'windup-sailor',
  'plunge-down', 'plunge-up', 'death',
  'ui-chime', 'ui-chest', 'ui-locked', 'ui-lever', 'ui-plate', 'ui-door', 'ui-grate', 'ui-glyph', 'ui-ignite',
] as const;

const ENEMIES: readonly Enemy[] = ['boar', 'crab', 'monkey', 'sailor'];
/** the island's own families on the procedural bank (08 §6.3 C.2; the engine's FAMILIES rows until S4.3: same counts, rates, seeds) */
export const ISLAND_VOICES: VoiceTable = {
  'impact-shell': { n: 4, ch: 1, half: false, gen: (sr: number, seed: number) => impact('shell', sr, seed) },
  ...Object.fromEntries(ENEMIES.map((e) => [`vocal-${e}`, { n: 3, ch: 1, half: e === 'sailor' || e === 'boar', gen: (sr: number, seed: number) => vocal(e, sr, seed) }])),
  'windup-boar': { n: 2, ch: 1, half: false, gen: (sr: number, seed: number) => windup('boar', sr, seed) },
  'windup-crab': { n: 2, ch: 1, half: false, gen: (sr: number, seed: number) => windup('crab', sr, seed) },
  'windup-sailor': { n: 2, ch: 1, half: true, gen: (sr: number, seed: number) => windup('sailor', sr, seed) },
};

export class IslandSfx {
  private side = 1;
  private armed = false;
  /** diagnostics: the last footstep's surface / gain / rate */
  lastStep: { surface: Surface; gain: number; rate: number } | undefined;

  constructor(private readonly audio: Audio, scope?: Scope) { audio.voices.register(ISLAND_VOICES, scope); }

  /** render the island's one-shots in the background (call once the graph exists: after audio.resume()) */
  prewarm(): void { this.audio.voices.prewarm(ISLAND_FAMILIES); }

  /** one footfall. `speed` (m/s) scales level and pitch: a crouch-creep is soft and low, a sprint loud and bright */
  footstep(surface: Surface, speed: number): void {
    if (!this.armed && this.audio.ready) { this.armed = true; this.prewarm(); } // the first step after the gesture starts the background render
    const k = Math.max(0.2, Math.min(1.15, speed / SPRINT));
    this.side = -this.side;
    const gain = STEP_LEVEL[surface] * (0.35 + 0.65 * k), rate = 0.9 + 0.14 * k;
    this.lastStep = { surface, gain, rate };
    this.audio.voices.play(`step-${surface}`, { gain, rate, pan: this.side * 0.12 });
  }

  whoosh(speed = 0.6, o: { heavy?: boolean; dir?: -1 | 1 } = {}): void {
    const s = Math.max(0, Math.min(1, speed)), dir = o.dir ?? 1;
    if (o.heavy === true) this.audio.voices.play('whoosh-heavy', { gain: 0.45 + 0.2 * s, rate: 0.9 + 0.15 * s, pan: -0.35 * dir, panTo: 0.35 * dir });
    else this.audio.voices.play('whoosh', { gain: 0.22 + 0.3 * s, rate: 0.82 + 0.38 * s, pan: -0.4 * dir, panTo: 0.4 * dir });
  }

  impact(material: Material, strength = 0.6, at?: At): void {
    const s = Math.max(0, Math.min(1, strength));
    this.audio.voices.play(`impact-${material}`, { gain: 0.4 + 0.45 * s, rate: 1.04 - 0.1 * s, at });
  }

  vocal(enemy: Enemy, at?: At, intensity = 1): void {
    this.audio.voices.play(`vocal-${enemy}`, { gain: VOCAL_LEVEL[enemy] * Math.max(0.2, Math.min(1.3, intensity)), at });
  }

  windup(enemy: WindupEnemy, at?: At): void {
    this.audio.voices.play(`windup-${enemy}`, { gain: WINDUP_LEVEL[enemy], at });
  }

  /** an interactable's sound (the adventure kit), placed at the object */
  interact(sound: InteractSound, at?: At, o: { gain?: number; delay?: number; release?: boolean } = {}): void {
    const base = INTERACT_LEVEL[sound] * (o.gain ?? 1) * (o.release === true ? 0.6 : 1);
    this.audio.voices.play(`ui-${sound}`, { gain: base, rate: o.release === true ? 1.18 : 1, at, delay: o.delay ?? 0, jitter: sound === 'chime' || sound === 'glyph' ? 0.02 : 0.05 });
  }

  plunge(up: boolean): void { this.audio.voices.play(up ? 'plunge-up' : 'plunge-down', { gain: up ? 0.35 : 0.5 }); }

  /** a gull's squawk: the set's sampled `gull` take when it decoded, else two (sometimes three) rasping saw notes */
  gullCall(pan = 0, gain = 1): void {
    const a = this.audio;
    tap.sound?.('gullCall');
    if (!a.ready || a.shot('gull', { pan, gain, out: a.ambient })) return;
    const c = a.ctx, t = c.currentTime;
    const bus = c.createGain(); bus.gain.value = 0.28 * gain;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    bus.connect(bp); a.route(bp, pan, a.ambient);
    const base = rnd(1050, 1350);
    // note 1: rises fast then bends down, wide fast vibrato (the rasp)
    a.tone({ t, type: 'sawtooth', f0: base * 0.85, f1: base * 1.25, glide: 0.06, gain: 1, attack: 0.015, hold: 0.05, decay: 0.09, vibrato: { rate: 42, depth: 90 }, lowpass: 4200, out: bus });
    a.tone({ t: t + 0.06, type: 'sawtooth', f0: base * 1.25, f1: base * 0.9, glide: 0.12, gain: 0.7, attack: 0.005, decay: 0.12, vibrato: { rate: 42, depth: 90 }, lowpass: 3600, out: bus });
    a.burst({ t, type: 'bandpass', freq: base * 2, q: 2, gain: 0.25, attack: 0.02, hold: 0.06, decay: 0.1, out: bus });
    // note 2: lower, shorter
    const t2 = t + rnd(0.2, 0.27);
    a.tone({ t: t2, type: 'sawtooth', f0: base * 0.95, f1: base * 0.62, glide: 0.16, gain: 0.8, attack: 0.012, hold: 0.03, decay: 0.15, vibrato: { rate: 36, depth: 70 }, lowpass: 3200, out: bus });
    a.burst({ t: t2, type: 'bandpass', freq: base * 1.6, q: 2, gain: 0.18, attack: 0.02, decay: 0.12, out: bus });
    if (audioRandom() < 0.35) {
      const t3 = t2 + rnd(0.2, 0.28);
      a.tone({ t: t3, type: 'sawtooth', f0: base * 0.8, f1: base * 0.55, glide: 0.14, gain: 0.55, attack: 0.012, decay: 0.14, vibrato: { rate: 30, depth: 60 }, lowpass: 2800, out: bus });
    }
  }

  /** gullCall positioned like `audio.animal()`: distance attenuation + a stereo pan from the listener yaw */
  gullCallAt(position: Vector3, listenerPos: Vector3, yaw = this.audio.listenerYaw): void {
    tap.sound?.('gullCallAt');
    if (!this.audio.ready) return;
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 160) return;
    const att = 1 / (1 + dist / 14) ** 1.3;
    const pan = panFromYaw(dx, dz, yaw, 0.8, dist);
    this.gullCall(pan, att);
  }
}

/** the bed id the island's synth bed answers to (the mixer's `setAmbient` id; the set's sampled `island` bed wins over it) */
export const ISLAND_BED = 'island';

/**
 * The island's synth bed (the mixer starts it when `island` is the bed and no sampled island bed decoded): a lighter,
 * warmer breeze than the pines (two wind bands with gentle gusts), the constant far surf hiss, and a swell rolling up the
 * beach every 6–9 s. Its gust and swell schedulers run on the bed's own Scope, disposed when the bed stops.
 */
export class IslandBed {
  private surfScope: Scope | undefined;
  private windGain: GainNode | undefined;
  private windGain2: GainNode | undefined;
  private zoned = false;

  constructor(private readonly audio: Audio) {}

  start(): void { if (!this.zoned) this.startIsland(); }
  stop(): void { this.surfScope?.dispose(); this.surfScope = undefined; this.windGain = this.windGain2 = undefined; }
  /** a zoned ambience replaces the synth bed: it is stopped / never started (a sampled bed still plays) */
  zone(): void {
    if (this.zoned) return;
    this.zoned = true;
    this.audio.restartSynthBed(ISLAND_BED);
  }

  private startIsland(): void {
    this.surfScope = new Scope('audio.ocean.surf');
    tap.sound?.('audio.startIsland');
    this.windGain = this.audio.mkWind(180, 0.4, -0.3, 0.05, 0.05, 900);   // a lighter, warmer breeze than the pines
    this.windGain2 = this.audio.mkWind(420, 0.6, 0.3, 0.08, 0.03, 1100);
    this.audio.mkWind(1500, 0.35, 0.0, 0.03, 0.02, 5000);                  // the constant far surf hiss
    this.scheduleGust(1.4);
    this.scheduleSurf();
  }

  /** a gust over the two wind bands every 5–12 s (× `gentle`): a rise, then the fall back to the band's base */
  private scheduleGust(gentle = 1): void {
    const wait = rnd(5, 12) * gentle;
    this.surfScope?.timeout(wait * 1000, () => {
      ambientTick('audio.gust', () => {
        const w1 = this.windGain, w2 = this.windGain2;
        if (this.audio.ambientOn && w1 && w2) {
          const t = this.audio.ctx.currentTime, rise = rnd(1.5, 3), fall = rnd(2, 4), amt = 1 + rnd(0.5, 1.6) / gentle;
          for (const g of [w1, w2]) {
            const base = g === w1 ? 0.05 : 0.03;
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

  private scheduleSurf(): void {
    const wait = rnd(6, 9);
    this.surfScope?.timeout(wait * 1000, () => {
      ambientTick('audio.surf', () => {
        if (this.audio.ambientOn) this.surfSwell();
        this.scheduleSurf();
      });
    });
  }

  /** one wave: a low rumble building over ~2 s, the break (a wide bright hiss), then the wash sliding back down the sand */
  private surfSwell(): void {
    const a = this.audio, c = a.ctx, t = c.currentTime;
    const pan = rnd(-0.35, 0.35), size = rnd(0.7, 1.15);
    const bus = c.createGain(); bus.gain.value = 0.42 * size;
    a.route(bus, pan, a.ambient);
    const build = rnd(1.6, 2.4), wash = rnd(2.6, 4.0);
    // the build: low noise rising in pitch and level
    a.burst({ t, type: 'lowpass', freq: 240, freqEnd: 700, gain: 0.5, attack: build, decay: 1.2, hold: 0.2, out: bus });
    // the break: wide, bright, a fast swell then the long wash tail that darkens as it drains
    a.burst({ t: t + build * 0.75, type: 'bandpass', freq: 1800, freqEnd: 500, q: 0.4, gain: 0.55, attack: 0.5, hold: 0.4, decay: wash, out: bus });
    a.burst({ t: t + build * 0.85, type: 'highpass', freq: 2600, gain: 0.16, attack: 0.35, hold: 0.3, decay: wash * 0.6, out: bus });
    // the foam fizz on the sand at the end
    a.burst({ t: t + build + 1.2, type: 'bandpass', freq: 4200, q: 0.6, gain: 0.08, attack: 0.6, decay: wash * 0.7, out: bus });
  }
}
