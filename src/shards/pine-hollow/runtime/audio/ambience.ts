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

const DEFAULT_PROFILE = requireAudioProfile(source.audio.zones, 'ambience.pine');
/** the beds that are positional (panned toward their zone's centre); the rest surround you */

/** a cabin's inside: its floor, and within the smallest cabin's half-width of the site along the door axis (the porch is past it) */
const FOREST_ZONES = ['hollow','pond','cabin','creek','waterfall','mill','ridge','oldgrowth','cave'] as const;
const ROOMS = ['cabin','den','oldgrowth','bowl'] as const;



export class ForestAmbience {
  private readonly scope: Scope;
  private readonly routing: AmbienceMix;
  private readonly surfaces:{surfaceAt:(x:number,z:number,y:number)=>StepSurface};
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

  constructor(audio: Audio, o: ForestAmbienceOpts, profile: AudioZoneProfile = DEFAULT_PROFILE) {
    this.scope = (o.scope ?? resourceScope()).child('ForestAmbience');
    this.sfx = new PineHollowSfx(audio);
    this.surfaces=audio.surfaceMap(requireAudioProfile(source.audio.surfaces,'forest step surfaces'),['planks','wet','mud','rock','litter'] as const,{heightAt:o.heightAt,floors:{cabins:[o.cabins]},values:{rain:()=>this.rain},circles:{pond:()=>hasPond()?POND:undefined}});
    this.spots = [...(o.spots ?? [])];
    this.routing = new AmbienceMix(audio,profile,{
      random:audioRandom,scope:this.scope,...(o.scope===undefined?{}:{zoneScope:this.scope}),heightAt:o.heightAt,sea:0,
      sample:{available:()=>this.sfx.available,load:id=>this.sfx.bed(requireAudioProfile(this.bedNames.get(id),'forest bed')),drop:id=>{this.sfx.dropBed(requireAudioProfile(this.bedNames.get(id),'forest bed'));}},
      sampleLive:ids=>{this.diag.beds=ids;},
      floors:{cabins:o.cabins},sites:{cabins:CABIN_SITES},circles:{pond:()=>hasPond()?POND:undefined},spots:{spots:()=>this.spots},pointLists:{fire:()=>o.cabins?.firePits??[]},
      inputs:{rawNight:()=>this.night,rawDawn:()=>this.dawn,rawRain:()=>this.rain,thr:()=>this.thrallLevel()},
      listener:(x,y,z,yaw)=>{this.px=x;this.py=y;this.pz=z;this.sfx.setListener(x,y,z,yaw);},
      onBuild:()=>{this.scheduleThrall();},
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

  /** what the player's boots are on (Player.onStep → audio.footstep(sprinting, amb.stepSurface(x, z, y))) */
  stepSurface(x: number, z: number, feetY: number): StepSurface {
    return this.surfaces.surfaceAt(x,z,feetY);
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
