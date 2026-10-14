import type { Camera } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { AmbienceZones } from '@wildshard/engine/audio/ambience';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { requireAudioProfile, audioMixValue, evaluateAudioMix, type AudioZoneProfile } from '@wildshard/engine/audio/audioProfiles';
import type { AudioOneShotSchedule, AudioMixExpr as MixExpr } from '@wildshard/format/audioProfiles';
import { audioRandom } from '@wildshard/engine/audio/util';
import type { FamilyName } from '@wildshard/engine/audio/Voices';
import { ambientTick } from '@wildshard/engine/core/harnessTap';

/**
 * A zoned soundscape's mix as rows (SHARD-PLATFORM M3): the listener, the emitters, the zone weights, every bed's level,
 * the reverb-room sends and the one-shot schedulers of an ambience profile, all described as data over the synth beds
 * (./synthBeds). Every frame moves the listener and the line emitters; at the profile's tick rate the mix evaluates its
 * value rows in order (expressions over the listener, the clock, the ports and the profile's zones, levels and wet sends),
 * sets each bed's level, steers its panners, sets its filter params, opens a room's send the first time its weight is
 * above zero, refreshes the diag and picks the dominant zone. One-shot rows (a swell riding beds' gains, or a voice of
 * oscillator notes) fire on their own timers, gated by an expression. Nothing here knows a shard: the ids, every number
 * and every formula are row data; the profile hands in its ports (ground height, objects that may carry bounds, points,
 * scalar readers). Nothing touches the AudioContext before the first frame after `audio.ready` (the first gesture).
 *
 *   const mix = new AmbienceMix(audio, profile, ROWS, { random: Math.random, scope: 'audio.x', heightAt, sea });
 *   mix.frame(dt, camera)    // every frame
 */

/** An operator of a mix expression. `zone` (a zone id) is the smoothstep from its outer to its inner radius at the
 *  listener; `dist` (a point prefix) the ground distance from the listener to `<p>.x`, `<p>.z`; `ss` a smoothstep (a, b, x);
 *  `in` 1 when a > lo and a < hi; `lt` / `gt` 1 or 0; `if` the second argument when the first is truthy, else the third;
 *  `and` / `or` / `not` truthiness; `+` and `*` fold left. */
/** A node the mix builds before the beds: a biquad or a positional panner, into another node; a panner may sit at a point
 *  or follow a zone's shoreline (rays marched in from the zone's outer radius until the ground breaks the sea, refined by
 *  bisection; the nearest point of that closed polyline each frame, at the sea's height). */
export interface MixNodeRow {
  readonly id: string;
  readonly out: string;
  /** a biquad: type, frequency, Q */
  readonly filter?: readonly [BiquadFilterType, number, number];
  /** an equal-power inverse-distance panner: refDistance, rolloffFactor, maxDistance */
  readonly panner?: readonly [number, number, number];
  /** the panner's fixed point (a point port) */
  readonly at?: string;
  /** the panner follows this zone's shoreline: rays, march step, bisection steps; `diag` names the distance (a diag key
   *  and a value, refreshed every frame) */
  readonly follow?: { readonly zone: string; readonly rays: number; readonly step: number; readonly refine: number; readonly diag: string };
}

/** A bounds port: `<id>` is 1 while `objects[from][key]` is a valid { x, z, r, yMin, yMax } (then `<id>.x` … are set), else 0. */
export interface MixBoundsRow { readonly id: string; readonly from: string; readonly key: string }

/** A nearness port over a point list: `<id>.sum` (each point within `radius` weighs 1 − d / radius), `<id>.dx`, `<id>.dz`
 *  (the weighted offsets toward them). */
export interface MixNearRow { readonly id: string; readonly radius: number }

/** A stereo panner the beds expose, steered toward a nearness port's side of the listener (± width) while it has weight. */
export interface MixSteerRow { readonly pan: string; readonly toward: string; readonly width: number; readonly tau: number }

/** A reverb room: a convolver on the generated IR, fed from the send bus through a gain that follows `level` once its
 *  `weight` value is above 0.001 (built then); `feeds` names other nodes that also feed it. */
export interface MixRoomRow { readonly id: string; readonly ir: FamilyName; readonly weight: string; readonly level: MixExpr; readonly feeds?: readonly string[] }

/** A profile's whole mix as rows. */
export interface AmbienceMixRows<Z extends string = string> {
  /** the families rendered before the graph is built, and the ones prewarmed once it is */
  readonly warm: readonly FamilyName[];
  readonly prewarm: readonly FamilyName[];
  /** the master low-pass's underwater cutoff (Hz) and ramp (s) */
  readonly underwater: readonly [number, number];
  readonly nodes: readonly MixNodeRow[];
  readonly bounds: readonly MixBoundsRow[];
  readonly near: readonly MixNearRow[];
  /** every bed's level: [bed id, expression] */
  readonly steer: readonly MixSteerRow[];
  /** filter params set every mix: [node, expression] → its frequency */
  readonly rooms: { readonly from: string; readonly to: string; readonly list: readonly MixRoomRow[] };
  /** the dominant zone: the first row whose expression holds (the last should always hold) */
  readonly zoneNames: readonly Z[];
}

/** A point port. */
export interface MixPoint { readonly x: number; readonly y?: number; readonly z: number }

/** What the profile hands the mix: its random stream (the synth pool and the one-shots draw from it), its scope's name,
 *  the ground and the sea, objects bounds ports read, point lists for nearness, fixed points and scalar readers. */
export interface AmbienceMixPorts {
  readonly random: () => number;
  readonly scope: string;
  readonly heightAt: (x: number, z: number) => number;
  readonly sea: number;
  readonly objects?: Readonly<Record<string, object | null | undefined>>;
  readonly near?: Readonly<Record<string, readonly { x: number; z: number }[] | undefined>>;
  readonly points?: Readonly<Record<string, MixPoint>>;
  readonly inputs?: Readonly<Record<string, () => number>>;
  /** runs first in the build (e.g. the profile's synth bed hands over to the zoned graph) */
  readonly onBuild?: () => void;
}

const BOUNDS_KEYS = ['x', 'z', 'r', 'yMin', 'yMax'] as const;

/** Builds and runs a profile's mix from rows. */
export class AmbienceMix<Z extends string = string> {
  /** 0 = day … 1 = night (the clock drives it) */
  night = 0;
  /** the dominant zone */
  zone: Z;
  /** the live mix, refreshed at the tick rate (the same object, keys in row order) */
  readonly diag: Record<string, number> = {};
  /** the one-shot schedulers and anything the profile registers: disposed with the profile */
  readonly scope: Scope;
  /** the profile's zoned beds */
  readonly zones: AmbienceZones;
  private readonly mixPorts:Parameters<typeof evaluateAudioMix>[1];
  private readonly inputRows:readonly [string,()=>number][];
  private readonly readValue=(id:string):number=>this.value(id);
  private readonly roomDefs = new Map<string,MixRoomRow>();
  private readonly zoneNames = new Map<string,Z>();
  private mixTime=0;
  private readonly audio: Audio;
  private readonly profile: AudioZoneProfile;
  private readonly rows: AmbienceMixRows<Z>;
  private readonly ports: AmbienceMixPorts;
  private readonly synth: ReturnType<Audio['createSynthBeds']>;
  private readonly marks:Record<string,()=>void>={};
  private readonly values = new Map<string, number>();
  private readonly nodes = new Map<string, AudioNode>();
  private readonly panners = new Map<string, PannerNode>();
  private readonly filters = new Map<string, BiquadFilterNode>();
  private readonly shores = new Map<string, Float32Array>();
  private readonly sends = new Map<string, GainNode>();
  private pans = new Map<string, StereoPannerNode>();
  private sendIn: GainNode | undefined;
  private built = false; private warming = false; private mixed = false;
  private underwater = false;
  private tick = 0; private t = 0;
  private readonly q = new Float32Array(2);

  constructor(audio: Audio, profile: AudioZoneProfile, rows: AmbienceMixRows<Z>, ports: AmbienceMixPorts, zone: Z) {
    this.audio = audio; this.profile = profile; this.rows = rows; this.ports = ports; this.zone = zone;
    const schedules=requireAudioProfile(profile.schedules,'ambient schedules');
    if(schedules.length>32)throw new Error('Ambient schedule capacity');
    for(let i=0;i<32;i++){const row=schedules[i];if(row!==undefined)this.marks[row.mark]=()=>{this.scheduleOneShot(row);};}
    this.inputRows=Object.entries(ports.inputs??{});
    if(rows.rooms.list.length>16||rows.zoneNames.length>32||rows.steer.length>32||this.inputRows.length>64)throw new Error('Ambience port rows exceed their bound');
    for(let i=0;i<16;i++){const room=rows.rooms.list[i];if(room!==undefined)this.roomDefs.set(room.id,room);}
    for(let i=0;i<32;i++){const id=rows.zoneNames[i];if(id!==undefined)this.zoneNames.set(id,id);}
    this.mixPorts = {
      read:id=>this.value(id),write:(id,value)=>{this.values.set(id,value);},
      level:(id,value)=>{const bed=this.zones.beds.get(id);if(bed!==undefined){bed.level=value;bed.gain.gain.setTargetAtTime(value,this.mixTime,this.profile.smoothSeconds);}},
      afterLevels:()=>{
        const mixture=this.rows,a=this.audio,t=this.mixTime;
    for (let index=0;index<32;index++) {
      const s=mixture.steer[index];if(s===undefined)continue;
      const p = this.pans.get(s.pan), pd = this.value(`${s.toward}.sum`);
      if (!p || !(pd > 0)) continue;
      const pdx = this.value(`${s.toward}.dx`), pdz = this.value(`${s.toward}.dz`), rx = -a.ctx.listener.forwardZ.value, rz = a.ctx.listener.forwardX.value;
      p.pan.setTargetAtTime(Math.max(-s.width, Math.min(s.width, (pdx * rx + pdz * rz) / (Math.hypot(pdx, pdz) + 1e-3) * s.width)), t, s.tau);
    }
      },
      cutoff:(id,value)=>{this.filters.get(id)?.frequency.setTargetAtTime(value,this.mixTime,this.profile.smoothSeconds);},
      room:(id,weight,level)=>{const room=this.roomDefs.get(id);if(room===undefined)throw new Error('Unknown ambience room');const gain=weight>0.001?this.send(room):this.sends.get(id);gain?.gain.setTargetAtTime(level,this.mixTime,this.profile.smoothSeconds);},
      diag:(id,value)=>{this.diag[id]=value;},
    };
    this.scope = new Scope(ports.scope);
    this.zones = new AmbienceZones(audio, audioRandom);
    this.synth = audio.createSynthBeds(this.zones, ports.random);
    const diag=requireAudioProfile(profile.mix,'ambience.mix').diag;
    for(let i=0;i<64;i++){const row=diag[i];if(row!==undefined)this.diag[row[0]]=0;}
    for (const z of profile.zones) for (const k of ['x', 'z', 'inner', 'outer', 'gain'] as const) this.values.set(`${z.id}.${k}`, z[k]);
    for (const [k, v] of Object.entries(profile.levels)) this.values.set(`level.${k}`, v);
    for (const [k, v] of Object.entries(profile.wet)) this.values.set(`wet.${k}`, v);
    for (const [id, p] of Object.entries(ports.points ?? {})) { this.values.set(`${id}.x`, p.x); this.values.set(`${id}.z`, p.z); if (p.y !== undefined) this.values.set(`${id}.y`, p.y); }
    this.values.set('sea', ports.sea);
    for (const n of rows.nodes) if (n.follow) this.shores.set(n.id, this.traceShore(n.follow.zone, n.follow.rays, n.follow.step, n.follow.refine));
  }

  /** a zone's shoreline: rays from its centre, each marched in from its outer radius until the ground breaks the sea */
  private traceShore(id: string, rays: number, step: number, refine: number): Float32Array {
    const zone = this.profile.zones.find((z) => z.id === id);
    if (!zone) throw new Error(`ambienceMix: no zone '${id}'`);
    const { heightAt: H, sea } = this.ports, out = new Float32Array(rays * 2);
    if(!Number.isSafeInteger(rays)||rays<1||rays>8192||!Number.isSafeInteger(refine)||refine<0||refine>64||!(step>0))throw new Error('Invalid ambience shore bounds');
    for (let i = 0; i < 8192; i++) {
      if(i>=rays)break;
      const a = (i / rays) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      let r = zone.outer, hit = -1;
      for (let march=0; march<8192; march++){if(r<=step)break;if(H(zone.x+cx*r,zone.z+cz*r)>sea){hit=r;break;}r-=step;}
      if(hit<0&&r>step)throw new Error('Ambience shore march exceeds its bound');
      if (hit > 0) { let lo = hit, hi = hit + step; for (let k = 0; k < 64; k++) { if(k>=refine)break; const m = (lo + hi) / 2; if (H(zone.x + cx * m, zone.z + cz * m) > sea) lo = m; else hi = m; } r = lo; }
      else r = zone.inner;
      out[i * 2] = zone.x + cx * r; out[i * 2 + 1] = zone.z + cz * r;
    }
    return out;
  }

  /** the nearest point on a closed polyline to (x, z) → out[0..1]; returns the distance */
  private nearest(s: Float32Array, x: number, z: number, out: Float32Array): number {
    const n = s.length / 2; let best = Infinity;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = s[i * 2] ?? 0, az = s[i * 2 + 1] ?? 0, bx = s[j * 2] ?? 0, bz = s[j * 2 + 1] ?? 0;
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
      const qx = ax + ex * u, qz = az + ez * u, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; out[0] = qx; out[1] = qz; }
    }
    return Math.sqrt(best);
  }

  private node(id: string): AudioNode {
    const n = this.zones.beds.get(id)?.gain ?? this.nodes.get(id);
    if (n === undefined) throw new Error(`ambienceMix: no node '${id}'`);
    return n;
  }

  private build(): void {
    this.built = true;
    const a = this.audio, c = a.ctx, rows = this.rows;
    this.ports.onBuild?.();
    const [cutoff, ramp] = rows.underwater; a.underwaterCutoff = cutoff; a.underwaterRamp = ramp;
    a.voices.prewarm([...rows.prewarm]);
    this.nodes.set('ambient', a.ambient); this.nodes.set('world', a.world); this.nodes.set('sfx', a.sfx);
    for (const n of rows.nodes) {
      const out = this.node(n.out);
      if (n.filter) { const f = this.synth.biquad(...n.filter); f.connect(out); this.nodes.set(n.id, f); this.filters.set(n.id, f); }
      else if (n.panner) {
        const p = c.createPanner(), [ref, rolloff, max] = n.panner;
        p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = max;
        if (n.at !== undefined) { p.positionX.value = this.value(`${n.at}.x`); p.positionY.value = this.value(`${n.at}.y`); p.positionZ.value = this.value(`${n.at}.z`); }
        p.connect(out); this.nodes.set(n.id, p); this.panners.set(n.id, p);
      }
    }
    const outs: Record<string, AudioNode> = Object.fromEntries(this.nodes);
    this.pans = this.synth.assemble(requireAudioProfile(this.profile.graph, 'Missing declared synth graph'), outs, this.marks).pans;
    const sendIn = c.createGain(); sendIn.gain.value = 1; this.node(rows.rooms.from).connect(sendIn); this.sendIn = sendIn;
  }

  /** a room's send (and convolver), built the first time it is needed */
  private send(room: MixRoomRow): GainNode | undefined {
    const have = this.sends.get(room.id); if (have) return have;
    const a = this.audio, ir = a.voices.buffer(room.ir);
    if (!ir || !this.sendIn) return undefined;
    const c = a.ctx, g = c.createGain(); g.gain.value = 0;
    const conv = c.createConvolver(); conv.normalize = false; conv.buffer = ir;
    this.sendIn.connect(g).connect(conv).connect(this.node(this.rows.rooms.to));
    for (const f of room.feeds ?? []) this.nodes.get(f)?.connect(g);
    this.sends.set(room.id, g);
    return g;
  }

  // ─────────────── timers (not per frame) ───────────────
  private scheduleOneShot(row: AudioOneShotSchedule): void {
    const [base, spread, night] = row.every;
    this.scope.timeout((base + this.ports.random() * spread * (1 + this.night * night)) * 1000, () => {
      ambientTick(row.tick, () => {
        this.values.set('night', this.night); this.values.set('underwater', this.underwater ? 1 : 0);
        if (row.when === undefined || (this.mixed && this.truthy(this.eval(row.when)))) {
          this.playProgram(row);
        }
        this.scheduleOneShot(row);
      });
    });
  }

  private playProgram(row:AudioOneShotSchedule):void {
    const targets:Record<string,AudioNode>={};let first:AudioNode|undefined;
    for(let i=0;i<32;i++){const id=row.targets[i];if(id===undefined)continue;const node=this.zones.beds.get(id)?.gain??this.nodes.get(id);if(node===undefined)return;targets[id]=node;first??=node;}
    if(first===undefined)return;
    const program=requireAudioProfile(this.profile.programs?.[row.program],'ambient phrase');
    this.audio.playPhrase(program,first,Object.fromEntries(this.values),this.ports.random,targets);
  }

  // ─────────────── per frame ───────────────
  /** the listener and the line emitters every frame; the mix at the profile's tick rate */
  frame(dt: number, camera: Camera): void {
    const a = this.audio;
    if (!a.ready) return;
    if (!this.built) {
      // the raw material renders in the background first (a few ms a slice), then the graph is built in one go
      if (!this.warming) { this.warming = true; a.voices.prewarm([...this.rows.warm]); }
      if (!this.rows.warm.every((f) => a.voices.has(f))) return;
      this.build();
    }
    this.t += dt;
    const m = camera.matrixWorld.elements;
    const x = m[12], y = m[13], z = m[14];
    this.values.set('x', x); this.values.set('y', y); this.values.set('z', z);
    const l = a.ctx.listener;
    l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    l.forwardX.value = -m[8]; l.forwardY.value = -m[9]; l.forwardZ.value = -m[10];
    l.upX.value = m[4]; l.upY.value = m[5]; l.upZ.value = m[6];
    a.voices.setListener(x, y, z, Math.atan2(m[8], m[10])); // forward = (−sin, −cos)
    for (const n of this.rows.nodes) {
      const shore = this.shores.get(n.id), p = this.panners.get(n.id);
      if (!shore || !n.follow) continue;
      const d = this.nearest(shore, x, z, this.q);
      if (p) { p.positionX.value = this.q[0] ?? 0; p.positionY.value = this.ports.sea; p.positionZ.value = this.q[1] ?? 0; }
      this.diag[n.follow.diag] = d; this.values.set(n.follow.diag, d);
    }
    this.tick += dt;
    if (this.tick >= 1 / this.profile.tickHz) { this.tick = 0; this.mix(); }
  }

  /** head under / over the surface: the mix runs at once */
  setUnderwater(on: boolean): void { this.underwater = on; if (this.built) this.mix(); }

  private value(name: string): number {
    const v = this.values.get(name);
    if (v !== undefined) return v;
    if (name.startsWith('bed.')) return this.zones.beds.get(name.slice(4))?.level ?? 0;
    throw new Error(`ambienceMix: no value '${name}'`);
  }

  private truthy(v: number): boolean { return v !== 0 && !Number.isNaN(v); }

  private eval(e:MixExpr):number { return audioMixValue(e,this.readValue); }

  /** the ports and rows → every bed's target level, panners, filters, reverb sends, the diag and the zone */
  private mix(): void {
    const a = this.audio, rows = this.rows, V = this.values, t = a.ctx.currentTime;
    const x = this.value('x'), z = this.value('z');
    V.set('night', this.night); V.set('underwater', this.underwater ? 1 : 0); V.set('t', this.t);
    V.set('ground', this.ports.heightAt(x, z));
    for(let i=0;i<64;i++){const row=this.inputRows[i];if(row!==undefined)V.set(row[0],row[1]());}
    for (const b of rows.bounds) {
      const box = boundsOf(this.ports.objects?.[b.from], b.key);
      V.set(b.id, box ? 1 : 0);
      if (box) for (const k of BOUNDS_KEYS) V.set(`${b.id}.${k}`, box[k]);
    }
    for (const n of rows.near) {
      let pd = 0, pdx = 0, pdz = 0;
      const r2 = n.radius * n.radius;
      for (const p of this.ports.near?.[n.id] ?? []) { const dx = p.x - x, dz = p.z - z, dd = dx * dx + dz * dz; if (dd < r2) { const w = 1 - Math.sqrt(dd) / n.radius; pd += w; pdx += dx * w; pdz += dz * w; } }
      V.set(`${n.id}.sum`, pd); V.set(`${n.id}.dx`, pdx); V.set(`${n.id}.dz`, pdz);
    }
    this.mixTime=t;
    const selected=evaluateAudioMix(requireAudioProfile(this.profile.mix,'ambience.mix'),this.mixPorts);
    const zone=requireAudioProfile(this.zoneNames.get(selected),'ambience.zone');this.zone=zone;
    this.mixed = true;
  }

  /** the schedulers stop (the mixer's unloadLevel fades what is left) */
  dispose(): void { this.scope.dispose(); }
}

/** a Bounds-shaped `key` on an object, if it has one (duck-typed: works before and after a model lands it) */
function boundsOf(o: object | null | undefined, key: string): Record<(typeof BOUNDS_KEYS)[number], number> | undefined {
  if (!o || !(key in o)) return undefined;
  const v: unknown = Reflect.get(o, key);
  if (typeof v !== 'object' || v === null) return undefined;
  const n = (k: string): number => { const x: unknown = Reflect.get(v, k); return typeof x === 'number' ? x : Number.NaN; };
  const b = { x: n('x'), z: n('z'), r: n('r'), yMin: n('yMin'), yMax: n('yMax') };
  return Number.isFinite(b.x + b.z + b.r + b.yMin + b.yMax) && b.r > 0 ? b : undefined;
}
