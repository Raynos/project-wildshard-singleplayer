/**
 * ForestAmbience — Pine Hollow's zoned soundscape and reverb zones (PINE-HOLLOW-REMASTER PH-A2 / PH-A5), the IslandAmbience
 * pattern with generated beds (src/audio/PineHollowSfx.ts: public/assets/sfx/pine-hollow/, MOSS-SoundEffect v2 vs Stable
 * Audio 3 Medium, the better take per bed).
 *
 *   const amb = new ForestAmbience(audio, { heightAt, cabins });
 *   game.onUpdate((dt) => amb.update(dt, game.camera));   // listener every frame, the zone mix at 10 Hz
 *   amb.night = 0 … 1 · amb.dawn = 0 … 1 · amb.rain = 0 … 1 · amb.thralls = 0 … 1   // the clock / weather / the King's night
 *   amb.setUnderwater(true | false)                      // the pond (next to audio.setUnderwater)
 *   amb.stepSurface(x, z, feetY)                         // 'planks' in a cabin / on a porch · 'mud' at the pond's edge · 'rock'
 *                                                        //   on steep facets · 'wet' in the rain · else 'litter' (pine needles)
 *   amb.addSpot({ zone: 'waterfall', x, z, r })          // a zone the layout places later (creek / waterfall / mill / ridge /
 *                                                        //   oldgrowth / cave): its bed + reverb come alive, no other change
 *   amb.onZone = (zone) => …                             // the dominant zone changed — a hook for the music / the HUD
 *   amb.sfx                                              // the Pine Hollow one-shots + barks (PineHollowSfx)
 *   amb.diag                                             // the live mix (every bed's level, every reverb send)
 *
 * Zones live today: **the Hollow** (everywhere outdoors that is not another zone: wind in the pines, a woodpecker), **the
 * pond** (frogs, a loon, dragonflies; panned toward the water, louder near it) and **the cabin interiors** (the fire's
 * crackle; the outdoor beds — Audio's forest bed through `audio.shadeAmbient`, and these — muffled through the walls). The
 * layout's zones are placed by src/pinehollow/audioWiring.ts (`addSpot`): the creek along its bed, the waterfall, the mill
 * wheel (while it turns), ridge wind on the crest + the lookout, the old-growth hush, the bear cave's mouth; the clock and the
 * weather drive night (owls + crickets, the thralls' far calls in the fog), rain on the canopy vs in the open, the dawn chorus.
 * Every file was downloaded at Pine Hollow's loading bar (E44); a bed is decoded from that offline cache the first time its
 * weight is above zero and let go 60 s after it last was (the phone keeps ~6 MB of PCM per 30 s stereo bed). Beds coming
 * up / down and zone changes land in `window.__audioLog`.
 *
 * Reverb (PH-A5): ConvolverNodes with generated IRs (src/audio/gen.ts: cabin 0.5 s, den 1.8 s, oldgrowth 1.4 s, bowl 0.9 s),
 * fed from the sfx bus through a send per room whose level follows how far inside it you are; the returns go to
 * `audio.world`. **The cabin reverb is live** (inside any cabin); the bowl's slap is a light send across the Hollow; the den
 * (the cave's mouth) and the old-growth follow their spots. A room's convolver is only built when first needed.
 * Settings ▸ Sound effects = Synth: no beds (Audio's synth forest bed plays), the reverb still works.
 */
import type { Camera } from 'three';
import type { Audio, StepSurface } from './Audio';
import { PineHollowSfx, type PhBed } from './PineHollowSfx';
import { CABIN_SITES, POND, hasPond } from '../world/Heightfield';
import { audioLog } from './audioLog';

export type ForestZone = 'hollow' | 'pond' | 'cabin' | 'creek' | 'waterfall' | 'mill' | 'ridge' | 'oldgrowth' | 'cave';
type Room = 'cabin' | 'den' | 'oldgrowth' | 'bowl';
/** a zone the layout places: a circle (x, z, r) that fades in over `fade` metres outside it; `open` = no canopy (rain);
 *  `gain` = a live 0..1 on its weight (the mill wheel turning or not) */
export interface ZoneSpot { zone: Exclude<ForestZone, 'hollow' | 'pond' | 'cabin'>; x: number; z: number; r: number; fade?: number; open?: boolean; gain?: () => number }

export interface ForestAmbienceOpts {
  heightAt: (x: number, z: number) => number;
  /** the cabins (src/world/Cabin.ts): their floors say when you are inside */
  cabins?: { floorHeightAt: (x: number, z: number) => number | undefined; firePits?: readonly { x: number; y: number; z: number }[] } | null;
  /** zones placed by the layout (src/pinehollow/audioWiring.ts adds Pine Hollow's with `addSpot`) */
  spots?: readonly ZoneSpot[];
}

const ss = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TAU = 0.1;
const ZONE_HZ = 10;
/** the ambient bus's level (Audio's `ambient` gain is 0.55) — these beds sit beside it on `world` */
const OUT = 0.55;
/** each bed's level at full weight, before sfx.json's gain (the files are at -24 LUFS) */
const LEVEL: Record<PhBed, number> = {
  hollow: 0.7, pond: 1.0, cabin: 1.1, creek: 0.9, waterfall: 1.1, mill: 0.9, ridge: 0.9, oldgrowth: 1.0, cave: 1.0,
  night: 0.9, nightfog: 0.7, 'rain-canopy': 1.0, 'rain-open': 0.9, dawn: 0.9,
};
/** the beds that are positional (panned toward their zone's centre); the rest surround you */
const PANNED = new Set<PhBed>(['pond', 'creek', 'waterfall', 'mill']);
/** wet level per room at full weight (the IRs are unit-energy) */
const WET: Record<Room, number> = { cabin: 0.4, den: 0.55, oldgrowth: 0.3, bowl: 0.12 };
/** a cabin's inside: its floor, and within the smallest cabin's half-width of the site along the door axis (the porch is past it) */
const CABIN_HALF_W = 2.45;
const ROCK_SLOPE = 0.32;
const DROP_S = 60;

interface Bed { name: PhBed; gain: GainNode; pan: StereoPannerNode | undefined; level: number; src: AudioBufferSourceNode | undefined; pending: boolean; idle: number; heard: boolean }

export class ForestAmbience {
  night = 0; dawn = 0; rain = 0;
  /** the thralls' far calls (0 … 1); defaults to following the night when never set */
  thralls: number | undefined;
  zone: ForestZone = 'hollow';
  onZone?: (zone: ForestZone) => void;
  readonly sfx: PineHollowSfx;
  readonly diag = {
    hollow: 0, pond: 0, cabin: 0, creek: 0, waterfall: 0, mill: 0, ridge: 0, oldgrowth: 0, cave: 0, night: 0, rain: 0, dawn: 0,
    sends: { cabin: 0, den: 0, oldgrowth: 0, bowl: 0 } as Record<Room, number>, beds: [] as string[], underwater: 0,
  };

  private built = false;
  private out: GainNode | undefined;
  private occl: BiquadFilterNode | undefined;
  private beds = new Map<PhBed, Bed>();
  private sendIn: GainNode | undefined;
  private sends = new Map<Room, GainNode>();
  private spots: ZoneSpot[];
  private tick = 0;
  private px = 0; private py = 0; private pz = 0;
  private underwater = false;
  private timers: number[] = [];

  constructor(private readonly audio: Audio, private readonly o: ForestAmbienceOpts) {
    this.sfx = new PineHollowSfx(audio);
    this.spots = [...(o.spots ?? [])];
  }

  addSpot(s: ZoneSpot): void { this.spots.push(s); }

  // ─────────────── build ───────────────
  private build(): void {
    this.built = true;
    const a = this.audio, c = a.ctx;
    const out = c.createGain(); out.gain.value = OUT; out.connect(a.world); this.out = out;
    const occl = c.createBiquadFilter(); occl.type = 'lowpass'; occl.frequency.value = 20000; occl.Q.value = 0.5; occl.connect(out); this.occl = occl;
    const sendIn = c.createGain(); sendIn.gain.value = 1; a.sfx.connect(sendIn); this.sendIn = sendIn;
    a.voices.prewarm(['ir-cabin', 'ir-bowl']);
    // the set's files (and the Pine Hollow music) were downloaded at the loading bar and the one-shots decoded there (E44):
    // nothing is fetched from here on — a bed decodes from the offline cache when its zone first wants it
    this.scheduleThrall();
  }

  /** a bed's graph, made on first need; its buffer decodes in the background and fades in when it lands */
  private bed(name: PhBed): Bed | undefined {
    const have = this.beds.get(name);
    if (have) return have;
    if (!this.out || !this.occl) return undefined;
    const c = this.audio.ctx, g = c.createGain(); g.gain.value = 0;
    let pan: StereoPannerNode | undefined;
    if (PANNED.has(name) && 'createStereoPanner' in c) { pan = c.createStereoPanner(); g.connect(pan).connect(this.occl); } else g.connect(name === 'cabin' ? this.out : this.occl);
    const b: Bed = { name, gain: g, pan, level: 0, src: undefined, pending: true, idle: 0, heard: false };
    this.beds.set(name, b);
    void this.sfx.bed(name).then((l) => {
      b.pending = false;
      if (!l || this.beds.get(name) !== b) { if (!l) audioLog('bed', name, false, 'will not decode'); return undefined; }
      const s = c.createBufferSource(); s.buffer = l.buffer; s.loop = true; s.loopStart = l.loopStart; s.loopEnd = l.loopEnd;
      const k = c.createGain(); k.gain.value = l.gain * LEVEL[name];
      s.connect(k).connect(g); s.start(c.currentTime + 0.05, l.loopStart + Math.random() * (l.loopEnd - l.loopStart));
      b.src = s;
      audioLog('bed', name, true, 'loop in');
      return undefined;
    });
    return b;
  }
  private dropBed(b: Bed): void {
    try { b.src?.stop(); } catch { /* not started */ }
    b.gain.disconnect(); this.beds.delete(b.name); this.sfx.dropBed(b.name);
  }

  /** the room's send (and convolver), built the first time it is needed */
  private send(room: Room): GainNode | undefined {
    const have = this.sends.get(room); if (have) return have;
    const a = this.audio, ir = a.voices.buffer(`ir-${room}`);
    if (!ir || !this.sendIn) { a.voices.prewarm([`ir-${room}`]); return undefined; }
    const c = a.ctx, g = c.createGain(); g.gain.value = 0;
    const conv = c.createConvolver(); conv.normalize = false; conv.buffer = ir;
    this.sendIn.connect(g).connect(conv).connect(a.world);
    this.sends.set(room, g);
    return g;
  }

  // ─────────────── timers (not per frame) ───────────────
  private later(sec: number, fn: () => void): void { this.timers.push(window.setTimeout(fn, sec * 1000)); if (this.timers.length > 16) this.timers.shift(); }
  /** the King's thralls calling from the fog at night: a far, eerie call from a random side, 25-60 m out */
  private scheduleThrall(): void {
    this.later(9 + Math.random() * 16, () => {
      const k = this.thrallLevel();
      if (k > 0.05 && !this.underwater && this.diag.cabin < 0.5 && Math.random() < 0.35 + 0.5 * k) {
        const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 35;
        this.sfx.shot('thrall_call', { at: { x: this.px + Math.cos(a) * d, y: this.py, z: this.pz + Math.sin(a) * d }, gain: 0.9 * k });
      }
      this.scheduleThrall();
    });
  }
  private thrallLevel(): number { return Math.max(0, Math.min(1, this.thralls ?? this.night * 0.5)); }

  // ─────────────── per frame ───────────────
  update(dt: number, camera: Camera): void {
    const a = this.audio;
    if (!a.ready) return;
    if (!this.built) this.build();
    const m = camera.matrixWorld.elements;
    const x = m[12], y = m[13], z = m[14];
    this.px = x; this.py = y; this.pz = z;
    this.sfx.setListener(x, y, z, Math.atan2(m[8], m[10]));
    this.tick += dt;
    if (this.tick >= 1 / ZONE_HZ) { this.mix(this.tick); this.tick = 0; }
  }

  /** inside a cabin: on a floor, within the house's half-width of a site along its door axis (the porch is further out) */
  private inCabin(x: number, z: number, y: number): number {
    const f = this.o.cabins?.floorHeightAt(x, z);
    if (f === undefined || y < f || y > f + 3.2) return 0;
    for (const s of CABIN_SITES) {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot), lx = (x - s.x) * c - (z - s.z) * sn, lz = (x - s.x) * sn + (z - s.z) * c;
      if (Math.abs(lz) < 6 && lx < CABIN_HALF_W && lx > -6) return 1;
    }
    return 0;
  }

  /** the zone weights → every bed's target level, the ambient shade and every reverb send (10 Hz, 300 ms crossfades) */
  private mix(dt: number): void {
    const a = this.audio, t = a.ctx.currentTime, x = this.px, y = this.py, z = this.pz, D = this.diag;
    const uw = this.underwater ? 1 : 0, dry = 1 - uw;
    const night = Math.max(0, Math.min(1, this.night)), dawn = Math.max(0, Math.min(1, this.dawn)), rain = Math.max(0, Math.min(1, this.rain));
    const cabin = this.inCabin(x, z, y), outside = 1 - cabin;
    const pond = hasPond() ? ss(POND.r + 40, POND.r + 4, Math.hypot(x - POND.x, z - POND.z)) : 0;
    const spot: Record<string, number> = { creek: 0, waterfall: 0, mill: 0, ridge: 0, oldgrowth: 0, cave: 0 };
    let open = pond > 0.5 ? 1 : 0;
    for (const s of this.spots) {
      const w = ss(s.r + (s.fade ?? 25), s.r, Math.hypot(x - s.x, z - s.z)) * (s.gain ? Math.max(0, Math.min(1, s.gain())) : 1);
      spot[s.zone] = Math.max(spot[s.zone] ?? 0, w);
      if (s.open) open = Math.max(open, w);
    }
    const cave = spot['cave'] ?? 0, oldgrowth = spot['oldgrowth'] ?? 0, ridge = spot['ridge'] ?? 0;
    const others = Math.max(pond * 0.6, cave, ridge * 0.7, oldgrowth * 0.8);
    const hollow = (1 - others) * outside * (1 - 0.75 * night);
    // fire crackle: inside, or beside a fire pit
    let fire = cabin;
    for (const p of this.o.cabins?.firePits ?? []) fire = Math.max(fire, 0.55 * ss(9, 2, Math.hypot(x - p.x, z - p.z)));
    const walls = 1 - 0.8 * cabin, hush = 1 - 0.85 * cave;
    const thr = this.thrallLevel();
    const want: [PhBed, number][] = [
      ['hollow', hollow], ['pond', pond * (1 - 0.4 * night) * walls], ['cabin', fire],
      ['creek', (spot['creek'] ?? 0) * walls], ['waterfall', (spot['waterfall'] ?? 0) * walls], ['mill', (spot['mill'] ?? 0) * walls],
      ['ridge', ridge * outside], ['oldgrowth', oldgrowth * outside * (1 - 0.5 * night)], ['cave', cave],
      ['night', night * walls * hush], ['nightfog', night * thr * walls * hush], ['dawn', dawn * (1 - night) * walls * hush],
      ['rain-canopy', rain * (1 - open) * walls * hush], ['rain-open', rain * open * walls * hush],
    ];
    const listed = this.sfx.available;
    D.beds = [];
    for (const [name, w0] of want) {
      const w = w0 * dry;
      let b = this.beds.get(name);
      if (!b && w > 0.01 && listed) b = this.bed(name);
      if (!b) continue;
      b.level = w; b.gain.gain.setTargetAtTime(w, t, TAU);
      // the trigger log: a bed coming up (audible, > 0.05) or going down (< 0.02) — `ok` = its loop is decoded and playing
      if (!b.heard && w > 0.05) { b.heard = true; audioLog('bed', name, b.src !== undefined, `up ${w.toFixed(2)}${b.pending ? ' (decoding)' : ''}`); }
      else if (b.heard && w < 0.02) { b.heard = false; audioLog('bed', name, true, 'down'); }
      b.idle = w > 0.005 ? 0 : b.idle + dt;
      if (b.idle > DROP_S && !b.pending) this.dropBed(b);
      else if (b.src) D.beds.push(name);
    }
    // pan the positional beds toward their centre
    for (const [name, px, pz] of this.panTargets()) {
      const b = this.beds.get(name); if (!b?.pan) continue;
      const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz), l = a.ctx.listener;
      const rx = -l.forwardZ.value, rz = l.forwardX.value;
      b.pan.pan.setTargetAtTime(d > 1 ? Math.max(-0.75, Math.min(0.75, (dx * rx + dz * rz) / d * 0.75 * ss(4, 20, d))) : 0, t, 0.2);
    }
    // walls: the outdoor beds and the shard's own bed muffled inside; the day bed lowered at night
    this.occl?.frequency.setTargetAtTime(20000 * (1 - cabin) + 650 * cabin, t, TAU);
    a.shadeAmbient((1 - 0.7 * cabin) * (1 - 0.55 * night) * (1 - 0.6 * cave), 20000 * (1 - cabin) + 700 * cabin);
    // reverb sends
    const rooms: [Room, number][] = [['cabin', cabin], ['den', cave], ['oldgrowth', oldgrowth * outside], ['bowl', hollow > 0 ? 0.5 * (1 - others) * outside : 0]];
    for (const [room, w] of rooms) {
      const g = w > 0.001 ? this.send(room) : this.sends.get(room);
      g?.gain.setTargetAtTime(WET[room] * w * dry, t, TAU);
      D.sends[room] = w;
    }
    D.hollow = hollow; D.pond = pond; D.cabin = cabin; D.cave = cave; D.oldgrowth = oldgrowth; D.ridge = ridge;
    D.creek = spot['creek'] ?? 0; D.waterfall = spot['waterfall'] ?? 0; D.mill = spot['mill'] ?? 0;
    D.night = night; D.rain = rain; D.dawn = dawn; D.underwater = uw;
    const ranked: [ForestZone, number][] = [['cabin', cabin], ['cave', cave], ['pond', pond], ['waterfall', D.waterfall], ['mill', D.mill], ['creek', D.creek], ['ridge', ridge], ['oldgrowth', oldgrowth]];
    const top = ranked.reduce<[ForestZone, number]>((b, r) => (r[1] > b[1] ? r : b), ['hollow', 0.5]);
    if (top[0] !== this.zone) { this.zone = top[0]; audioLog('zone', top[0]); this.onZone?.(top[0]); }
  }
  private panTargets(): [PhBed, number, number][] {
    const out: [PhBed, number, number][] = [];
    if (hasPond()) out.push(['pond', POND.x, POND.z]);
    for (const s of this.spots) if (s.zone === 'creek' || s.zone === 'waterfall' || s.zone === 'mill') out.push([s.zone, s.x, s.z]);
    return out;
  }

  /** what the player's boots are on (Player.onStep → audio.footstep(sprinting, amb.stepSurface(x, z, y))) */
  stepSurface(x: number, z: number, feetY: number): StepSurface {
    const f = this.o.cabins?.floorHeightAt(x, z);
    if (f !== undefined && Math.abs(feetY - f) < 0.45) return 'planks';
    if (this.rain > 0.3) return 'wet';
    if (hasPond() && Math.hypot(x - POND.x, z - POND.z) < POND.r + 3.5) return 'mud';
    const H = this.o.heightAt, e = 1.0;
    const dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e);
    return 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz) > ROCK_SLOPE ? 'rock' : 'litter';
  }

  /** head under / over the pond's surface: the beds and sends drop while under */
  setUnderwater(on: boolean): void { this.underwater = on; if (this.built) this.mix(0); }

  dispose(): void { for (const id of this.timers) clearTimeout(id); this.timers = []; for (const b of this.beds.values()) this.dropBed(b); }
}
