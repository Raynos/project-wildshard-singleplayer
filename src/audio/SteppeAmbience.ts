/**
 * SteppeAmbience — Nalati's zoned soundscape (NALATI-MERGE A4), the IslandAmbience pattern for the steppe.
 *
 *   const amb = new SteppeAmbience(audio);        // src/nalati/sound.ts builds it in bind()
 *   amb.set({ zones, river, melt, camp, night, wind, gust, out, pan })   // ~4 Hz from sound.ts: where the listener is
 *   amb.update(dt, listener, yaw)                 // every frame: the gain ramps land on the 4 Hz mix, the far calls' timers
 *   amb.onZone = (zone) => …                      // the dominant zone changed (held 3 s at a line) — the score follows it (A2)
 *   amb.diag                                      // the live mix: every bed's level, the zone weights (headless checks)
 *
 * The three zones (src/chunks/nalati-grasslands.ts `zoneAt`: [valley, bowl, snow] weights that already blend at the lines):
 * - **Nalati Grasslands** (the green Kunes valley): grass wind, skylarks by day, the Kunes by its banks, the camp (a stove
 *   crackling, felt flaps) round the yurts;
 * - **Sky Grassland** (the golden bowl): a strong open wind, far-off herds (a neigh, a snort) and marmots whistling;
 * - **Snow Lotus Valley** (the snow ring): a cold thin wind, meltwater round the glacier and its stream, eagles far up.
 * Crickets replace the larks at night everywhere below the snow; the storm's rain and gale (Audio.stormSink) ride over all of
 * it; inside the kurgan (`out` 0) it is all gone.
 *
 * The beds are the one generated set's Nalati beds (sfx.json `beds`, decoded on the steppe only — preload.ts STEPPE_LOOPS):
 * each is one looping AudioBufferSourceNode through its own gain (+ a panner for the river / camp / meltwater, turned toward
 * the source) into `audio.ambient`, started the first time its level rises and stopped after 8 s of silence. With no bed
 * decoded (Settings ▸ Sound effects = Synth, or a failed decode) Audio's synth steppe bed plays as before and only the far
 * calls come from here; a set switch is picked up on the next mix (the beds restart on the new buffers).
 */
import { Vector3 } from 'three';
import type { Audio, SteppeLoop, SampleLoop } from './Audio';
import { STEPPE_LOOPS } from './preload';
import type { SteppeZone } from './SteppeScore';

export type { SteppeZone } from './SteppeScore';
/** where the listener is, from src/nalati/sound.ts (all 0..1 unless noted) */
export interface SteppePlace {
  /** [valley, bowl, snow] — zoneAt at the listener */
  zones: readonly [number, number, number];
  river: number; melt: number; camp: number; night: number;
  /** wind speed (m/s) and the gust front's strength at the listener */
  wind: number; gust: number;
  /** 1 outdoors, 0 in the kurgan's sealed chamber */
  out: number;
  /** the pan (−1 … 1) toward the river, the camp, the meltwater */
  pan: { river: number; camp: number; melt: number };
}

const TAU = 0.35;         // setTargetAtTime: ~1 s to 95 % (the mix changes at 4 Hz, walking pace)
const SILENT_S = 8;       // a bed silent this long stops its source
const ZONE_HOLD_S = 3;    // a zone must lead this long before onZone fires (no flapping on a line)
const PANNED: ReadonlySet<SteppeLoop> = new Set<SteppeLoop>(['river', 'camp', 'meltwater']);
const ZONES: readonly SteppeZone[] = ['grass', 'sky', 'snow'];
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

interface Bed { gain: GainNode; pan: StereoPannerNode | undefined; src: AudioBufferSourceNode | undefined; buf: AudioBuffer | undefined; level: number; quiet: number }

export class SteppeAmbience {
  onZone?: ((zone: SteppeZone) => void) | undefined;
  zone: SteppeZone = 'grass';
  /** the storm (Audio.stormSink): rain and gale, 0..1 */
  storm = { rain: 0, wind: 0 };
  readonly diag: Record<SteppeLoop, number> & { valley: number; bowl: number; snow: number; sampled: number; calls: number } = {
    'steppe-wind': 0, 'steppe-larks': 0, 'steppe-night': 0, river: 0, meltwater: 0, camp: 0, highwind: 0, coldwind: 0, rain: 0, stormwind: 0,
    valley: 1, bowl: 0, snow: 0, sampled: 0, calls: 0,
  };

  private readonly beds = new Map<SteppeLoop, Bed>();
  private place: SteppePlace = { zones: [1, 0, 0], river: 0, melt: 0, camp: 0, night: 0, wind: 5, gust: 0.3, out: 1, pan: { river: 0, camp: 0, melt: 0 } };
  private lead: SteppeZone = 'grass'; private leadT = 0; private first = true;
  private herdT = rnd(8, 18); private marmotT = rnd(6, 14); private eagleT = rnd(15, 30);

  constructor(private readonly audio: Audio) {
    audio.stormSink = (rain, wind) => {
      if (!this.sampled('rain') && !this.sampled('stormwind')) return false;
      this.storm.rain = rain; this.storm.wind = wind;
      return true;
    };
  }

  private sampled(k: SteppeLoop): SampleLoop | undefined { return this.audio.loop(k); }

  /** the listener's place (sound.ts, ~4 Hz): re-mixes every bed */
  set(p: SteppePlace): void {
    this.place = p;
    const [valley, bowl, snow] = p.zones;
    if (this.first) { // the spawn's zone counts at once (no 3 s hold, no crossfade from the valley's theme)
      this.first = false;
      this.zone = this.lead = ZONES[valley >= bowl && valley >= snow ? 0 : bowl >= snow ? 1 : 2] ?? 'grass';
      this.onZone?.(this.zone);
    }
    if (!this.audio.ready) return;
    const w = clamp01(p.wind / 14), g = clamp01(p.gust), day = 1 - clamp01(p.night), out = clamp01(p.out);
    const calm = 1 - clamp01(this.storm.wind * 1.4); // the gale drowns the birds and crickets
    const want: Record<SteppeLoop, number> = {
      'steppe-wind': (valley + 0.45 * bowl) * (0.35 + 0.4 * w + 0.35 * g),
      highwind: bowl * (0.3 + 0.45 * w + 0.35 * g) + 0.1 * valley * g,
      coldwind: snow * (0.45 + 0.35 * w + 0.25 * g),
      'steppe-larks': day * calm * (0.8 * valley + 0.45 * bowl) * (1 - 0.6 * w),
      'steppe-night': clamp01(p.night) * calm * (0.8 * valley + 0.7 * bowl + 0.15 * snow),
      river: 0.9 * clamp01(p.river),
      meltwater: 0.85 * clamp01(p.melt),
      camp: 0.8 * clamp01(p.camp),
      rain: 0.9 * clamp01(this.storm.rain),
      stormwind: 0.85 * clamp01(this.storm.wind),
    };
    let any = 0;
    for (const k of STEPPE_LOOPS) {
      const l = this.sampled(k), lv = l ? want[k] * out * l.gain : 0;
      if (l) any++;
      this.mix(k, l, lv);
      this.diag[k] = Math.round(lv * 1000) / 1000;
    }
    this.diag.valley = valley; this.diag.bowl = bowl; this.diag.snow = snow; this.diag.sampled = any;
    this.audio.sampledSteppe(any > 0);
    const pans: Partial<Record<SteppeLoop, number>> = { river: p.pan.river, camp: p.pan.camp, meltwater: p.pan.melt };
    const t = this.audio.ctx.currentTime;
    for (const k of PANNED) { const b = this.beds.get(k), v = pans[k] ?? 0; b?.pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)), t, TAU); }
  }

  /** one bed toward `level`: started on its first rise, restarted on a new buffer (a set switch), stopped after a silence */
  private mix(k: SteppeLoop, l: SampleLoop | undefined, level: number): void {
    let b = this.beds.get(k);
    const c = this.audio.ctx, t = c.currentTime;
    if (!b) {
      if (!l || level < 0.002) return;
      const gain = c.createGain(); gain.gain.value = 0;
      const pan = PANNED.has(k) && 'createStereoPanner' in c ? c.createStereoPanner() : undefined;
      if (pan) gain.connect(pan).connect(this.audio.ambient); else gain.connect(this.audio.ambient);
      b = { gain, pan, src: undefined, buf: undefined, level: 0, quiet: 0 };
      this.beds.set(k, b);
    }
    if (b.src && (!l || l.buffer !== b.buf)) { const s = b.src; s.stop(t + 1.2); b.src = undefined; b.buf = undefined; b.gain.gain.setTargetAtTime(0, t, 0.3); }
    if (l && !b.src && level >= 0.002) {
      const s = c.createBufferSource(); s.buffer = l.buffer; s.loop = true; s.loopStart = l.loopStart; s.loopEnd = l.loopEnd;
      s.connect(b.gain); s.start(t, l.loopStart + Math.random() * (l.loopEnd - l.loopStart)); // a random point: two beds never phase
      b.src = s; b.buf = l.buffer; b.quiet = 0;
    }
    b.level = level;
    b.gain.gain.setTargetAtTime(b.src ? level : 0, t, TAU);
  }

  /** every frame: stop the beds that have been silent a while, fire the zones' far calls, track the dominant zone */
  update(dt: number, listener: { x: number; y: number; z: number }, yaw: number): void {
    const p = this.place, [valley, bowl, snow] = p.zones, day = 1 - clamp01(p.night), out = p.out > 0.5 && this.storm.wind < 0.5;
    // the dominant zone, held ZONE_HOLD_S before it counts (the score follows it even before the first gesture)
    const top = ZONES[valley >= bowl && valley >= snow ? 0 : bowl >= snow ? 1 : 2] ?? 'grass';
    if (top !== this.lead) { this.lead = top; this.leadT = 0; }
    this.leadT += dt;
    if (this.lead !== this.zone && this.leadT >= ZONE_HOLD_S) { this.zone = this.lead; this.onZone?.(this.zone); }
    if (!this.audio.ready) return;
    const t = this.audio.ctx.currentTime;
    for (const b of this.beds.values()) {
      if (!b.src) continue;
      b.quiet = b.level < 0.002 ? b.quiet + dt : 0;
      if (b.quiet > SILENT_S) { b.src.stop(t + 0.1); b.src = undefined; b.buf = undefined; }
    }
    // the far calls: herds + marmots on the Sky Grassland, eagles over the Snow Lotus Valley (never in a gale or the kurgan)
    this.herdT -= dt; this.marmotT -= dt; this.eagleT -= dt;
    if (this.herdT <= 0) {
      this.herdT = rnd(14, 32);
      if (out && bowl > 0.35 && day > 0.3) this.far(Math.random() < 0.6 ? 'horse_neigh' : 'horse_snort', listener, yaw, 90, 200);
    }
    if (this.marmotT <= 0) {
      this.marmotT = rnd(9, 22);
      if (out && bowl + snow > 0.4 && day > 0.5) this.far('marmot_whistle', listener, yaw, 50, 140);
    }
    if (this.eagleT <= 0) {
      this.eagleT = rnd(22, 48);
      if (out && snow > 0.3 && day > 0.4) this.far('eagle_cry', listener, yaw, 140, 320, 60);
    }
  }

  private readonly at = new Vector3();
  private readonly ear = new Vector3();
  /** a call from a random direction `d0 … d1` m off (and `up` m above): Audio.animal attenuates, pans and low-passes it */
  private far(kind: 'horse_neigh' | 'horse_snort' | 'marmot_whistle' | 'eagle_cry', l: { x: number; y: number; z: number }, yaw: number, d0: number, d1: number, up = 10): void {
    const a = Math.random() * Math.PI * 2, d = rnd(d0, d1);
    this.ear.set(l.x, l.y, l.z);
    this.at.set(l.x + Math.cos(a) * d, l.y + up, l.z + Math.sin(a) * d);
    this.diag.calls++;
    this.audio.animal(kind, this.at, this.ear, yaw);
  }

  dispose(): void {
    const t = this.audio.ready ? this.audio.ctx.currentTime : 0;
    for (const b of this.beds.values()) { b.src?.stop(t); b.gain.disconnect(); }
    this.beds.clear();
    this.audio.stormSink = undefined;
    this.audio.sampledSteppe(false);
  }
}
