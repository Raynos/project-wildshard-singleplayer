import type { Scope } from '@wildshard/engine/app/scope';
import { resourceScope } from '@wildshard/engine/app/resources';
import { AmbienceMix } from '@wildshard/engine/audio/ambience';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { audioLog } from '@wildshard/engine/audio/audioLog';
import type { StepSurface } from '@wildshard/engine/audio/surface';
import { audioRandom } from '@wildshard/engine/audio/util';
import { ambientTick } from '@wildshard/engine/core/harnessTap';
import { CABIN_SITES, POND, hasPond } from '@wildshard/engine/world/Heightfield';
/**
 * ForestAmbience — Pine Hollow's zoned soundscape and reverb zones (PINE-HOLLOW-REMASTER PH-A2 / PH-A5), the IslandAmbience
 * pattern with generated beds (src/shards/pine-hollow/runtime/audio/sfx.ts: public/assets/sfx/pine-hollow/, MOSS-SoundEffect v2 vs Stable
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
 * layout's zones are placed by src/shards/pine-hollow/runtime/audio/wiring.ts (`addSpot`): the creek along its bed, the waterfall, the mill
 * wheel (while it turns), ridge wind on the crest + the lookout, the old-growth hush, the bear cave's mouth; the clock and the
 * weather drive night (owls + crickets, the thralls' far calls in the fog), rain on the canopy vs in the open, the dawn chorus.
 * Every file was downloaded at Pine Hollow's loading bar (E44); a bed is decoded from that offline cache the first time its
 * weight is above zero and let go 60 s after it last was (the phone keeps ~6 MB of PCM per 30 s stereo bed). Beds coming
 * up / down and zone changes land in `window.__audioLog`.
 *
 * Reverb (PH-A5): ConvolverNodes with generated IRs (src/engine/audio/gen.ts: cabin 0.5 s, den 1.8 s, oldgrowth 1.4 s, bowl 0.9 s),
 * fed from the sfx bus through a send per room whose level follows how far inside it you are; the returns go to
 * `audio.world`. **The cabin reverb is live** (inside any cabin); the bowl's slap is a light send across the Hollow; the den
 * (the cave's mouth) and the old-growth follow their spots. A room's convolver is only built when first needed.
 * Settings ▸ Sound effects = Synth: no beds (Audio's synth forest bed plays), the reverb still works.
 */
import type { Camera } from 'three';
import { PineHollowSfx, PH_BEDS, type PhBed } from './sfx';
import { requireAudioProfile, type AudioZoneProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

export type ForestZone = 'hollow' | 'pond' | 'cabin' | 'creek' | 'waterfall' | 'mill' | 'ridge' | 'oldgrowth' | 'cave';
type Room = 'cabin' | 'den' | 'oldgrowth' | 'bowl';
/** a zone the layout places: a circle (x, z, r) that fades in over `fade` metres outside it; `open` = no canopy (rain);
 *  `gain` = a live 0..1 on its weight (the mill wheel turning or not) */
export interface ZoneSpot { zone: Exclude<ForestZone, 'hollow' | 'pond' | 'cabin'>; x: number; z: number; r: number; fade?: number; open?: boolean; gain?: () => number }

export interface ForestAmbienceOpts {
  heightAt: (x: number, z: number) => number;
  /** Explicit resident owner for retained homes; ordinary construction keeps its original ambient owner. */
  scope?: Scope;
  /** the cabins (src/engine/world/Cabin.ts): their floors say when you are inside */
  cabins?: { floorHeightAt: (x: number, z: number) => number | undefined; firePits?: readonly { x: number; y: number; z: number }[] } | null;
  /** zones placed by the layout (src/shards/pine-hollow/runtime/audio/wiring.ts adds Pine Hollow's with `addSpot`) */
  spots?: readonly ZoneSpot[];
}

const ss = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DEFAULT_PROFILE = requireAudioProfile(source.audio.zones, 'ambience.pine');
/** the beds that are positional (panned toward their zone's centre); the rest surround you */

/** a cabin's inside: its floor, and within the smallest cabin's half-width of the site along the door axis (the porch is past it) */
const CABIN_HALF_W = 2.45;
const ROCK_SLOPE = 0.32;
const FOREST_ZONES = ['hollow','pond','cabin','creek','waterfall','mill','ridge','oldgrowth','cave'] as const;
const ROOMS = ['cabin','den','oldgrowth','bowl'] as const;
const SPOT_KEYS = ['creek','waterfall','mill','ridge','oldgrowth','cave'] as const;



export class ForestAmbience {
  private readonly scope: Scope;
  private readonly routing: AmbienceMix;
  private readonly bedNames = new Map<string,PhBed>(PH_BEDS.map(name=>[name,name] as const));
  private readonly roomNames = new Map<string,Room>(ROOMS.map(name=>[name,name] as const));
  private readonly zoneNames = new Map<string,ForestZone>(FOREST_ZONES.map(name=>[name,name] as const));
  private active = true;
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

  private spots: ZoneSpot[];
  private px = 0; private py = 0; private pz = 0;
  private underwater = false;
  private timers: (ReturnType<typeof setTimeout> | 0)[] = [];

  constructor(audio: Audio, private readonly o: ForestAmbienceOpts, profile: AudioZoneProfile = DEFAULT_PROFILE) {
    this.scope = (o.scope ?? resourceScope()).child('ForestAmbience');
    this.sfx = new PineHollowSfx(audio);
    this.spots = [...(o.spots ?? [])];
    this.routing = new AmbienceMix(audio,profile,{
      random:audioRandom,scope:this.scope,...(o.scope===undefined?{}:{zoneScope:this.scope}),heightAt:o.heightAt,sea:0,
      sample:{available:()=>this.sfx.available,load:id=>this.sfx.bed(requireAudioProfile(this.bedNames.get(id),'forest bed')),drop:id=>{this.sfx.dropBed(requireAudioProfile(this.bedNames.get(id),'forest bed'));}},
      sampleLive:ids=>{this.diag.beds=ids;},stereoTargets:()=>this.panTargets(),
      listener:(x,y,z,yaw)=>{this.px=x;this.py=y;this.pz=z;this.sfx.setListener(x,y,z,yaw);},
      observe:values=>this.observe(values),onBuild:()=>{this.scheduleThrall();},
      diagnostic:(id,value)=>{if(!(id in this.diag)||id==='beds'||id==='sends')throw new Error('Unknown forest diagnostic');Reflect.set(this.diag,id,value);},
      roomWeight:(id,value)=>{this.diag.sends[requireAudioProfile(this.roomNames.get(id),'forest room')]=value;},
      onZone:id=>{this.zone=requireAudioProfile(this.zoneNames.get(id),'forest zone');audioLog('zone',this.zone);this.onZone?.(this.zone);},
    },'hollow');
  }

  addSpot(s: ZoneSpot): void { this.spots.push(s); }

  // ─────────────── timers (not per frame) ───────────────
  private later(sec: number, fn: () => void): void { this.timers.push(this.scope.timeout(sec * 1000, fn)); if (this.timers.length > 16) this.timers.shift(); }
  /** the King's thralls calling from the fog at night: a far, eerie call from a random side, 25-60 m out */
  private scheduleThrall(): void {
    this.later(9 + Math.random() * 16, () => {
      ambientTick('forest.thrall', () => {
        const k = this.thrallLevel();
        if (k > 0.05 && !this.underwater && this.diag.cabin < 0.5 && Math.random() < 0.35 + 0.5 * k) {
          const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 35;
          this.sfx.shot('thrall_call', { at: { x: this.px + Math.cos(a) * d, y: this.py, z: this.pz + Math.sin(a) * d }, gain: 0.9 * k });
        }
        this.scheduleThrall();
      });
    });
  }
  private thrallLevel(): number { return Math.max(0, Math.min(1, this.thralls ?? this.night * 0.5)); }

  // ─────────────── per frame ───────────────
  update(dt: number, camera: Camera): void {
    this.routing.frame(dt,camera);
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
  private observe(values:Map<string,number>): boolean {
    const x=this.px,y=this.py,z=this.pz;
    if (!Number.isFinite(x + y + z + this.night + this.dawn + this.rain)) return false; // hold the last mix rather than feed NaN to the AudioParams (E278)
    const cabin = this.inCabin(x, z, y);
    const pond = hasPond() ? ss(POND.r + 40, POND.r + 4, Math.hypot(x - POND.x, z - POND.z)) : 0;
    const spot: Record<string, number> = { creek: 0, waterfall: 0, mill: 0, ridge: 0, oldgrowth: 0, cave: 0 };
    let open = pond > 0.5 ? 1 : 0;
    for (const s of this.spots) {
      const w = ss(s.r + (s.fade ?? 25), s.r, Math.hypot(x - s.x, z - s.z)) * (s.gain ? Math.max(0, Math.min(1, s.gain())) : 1);
      spot[s.zone] = Math.max(spot[s.zone] ?? 0, w);
      if (s.open) open = Math.max(open, w);
    }
    // fire crackle: inside, or beside a fire pit
    let fire = cabin;
    for (const p of this.o.cabins?.firePits ?? []) fire = Math.max(fire, 0.55 * ss(9, 2, Math.hypot(x - p.x, z - p.z)));
    values.set('x',x);values.set('y',y);values.set('z',z);values.set('cabin',cabin);values.set('pond',pond);values.set('open',open);values.set('fire',fire);
    values.set('underwater',this.underwater?1:0);values.set('rawNight',this.night);values.set('rawDawn',this.dawn);values.set('rawRain',this.rain);values.set('thr',this.thrallLevel());
    for(let i=0;i<6;i++){const key=SPOT_KEYS[i];if(key!==undefined)values.set(key,spot[key]??0);}
    return true;
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
  setUnderwater(on: boolean): void { this.underwater=on;this.routing.setUnderwater(on); }

  /** Stop entered beds and schedulers, and cut the reverb input before another cell borrows the shared audio buses. */
  setActive(on: boolean): void {
    if (this.active === on) return;
    this.active = on;
    if (!on) {
      for (const id of this.timers) this.scope.cancelTimer(id);
      this.timers = [];
    }
    this.routing.setActive(on);
    if(on&&this.routing.ready)this.scheduleThrall();
  }

  dispose(): void { for (const id of this.timers) this.scope.cancelTimer(id); this.timers = []; this.routing.dropSamples(); }
}
