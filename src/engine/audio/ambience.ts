import type { Camera } from 'three';
import { Scope } from '../app/scope';
import { audioLog } from './audioLog';
import { tap, ambientTick } from '../core/harnessTap';
import type { AudioAmbienceRouting, AudioMixExpr as MixExpr, AudioOneShotSchedule } from '@wildshard/format/audioProfiles';
import { requireAudioProfile, requireAudioLevel, audioMixValue, evaluateAudioMix, type AudioZoneProfile } from './audioProfiles';
import type { Audio, SampleLoop } from './Audio';
import type { AudioMixer } from './levelAudio';
import { ownAudioSource } from './ownership';
import { loopAt, audioRandom } from './util';

export interface ZoneVoice {
  gain: GainNode; pan: StereoPannerNode | undefined; src: AudioBufferSourceNode | undefined;
  buf: AudioBuffer | undefined; level: number; quiet: number;
}
export interface ZoneBed {
  id: string; panned?: boolean; out?: () => AudioNode; started: () => void;
}
/** Shared loop lifecycle; profiles keep their zone weights, fade constants and literal taps. */
export class AmbienceZones {
  readonly beds = new Map<string, ZoneVoice>();
  private readonly audio: AudioMixer;
  private readonly scope: Scope | undefined;
  private readonly random: () => number;
  constructor(audio: AudioMixer, random: () => number, scope?: Scope) {
    this.audio = audio; this.random = random; this.scope = scope;
    scope?.onDispose(() => { this.dispose(); });
  }
  ensure(def: ZoneBed): ZoneVoice {
    const have = this.beds.get(def.id); if (have) return have;
    const c = this.audio.ctx, gain = c.createGain(); gain.gain.value = 0;
    const pan = def.panned === true && 'createStereoPanner' in c ? c.createStereoPanner() : undefined;
    const out = def.out?.() ?? this.audio.bus('ambience');
    if (pan) gain.connect(pan).connect(out); else gain.connect(out);
    const bed: ZoneVoice = { gain, pan, src: undefined, buf: undefined, level: 0, quiet: 0 };
    this.beds.set(def.id, bed); return bed;
  }
  start(def: ZoneBed, sample: SampleLoop, time = this.audio.ctx.currentTime, scale = 1): ZoneVoice {
    const bed = this.ensure(def), c = this.audio.ctx;
    const source = this.scope ? c.createBufferSource() : ownAudioSource(c.createBufferSource());
    let scaled: GainNode | undefined;
    if (scale !== 1) { scaled = c.createGain(); scaled.gain.value = scale; source.connect(scaled).connect(bed.gain); }
    else source.connect(bed.gain);
    let started = false, ended = false;
    const endedSignal = new AbortController();
    let forget = (): void => { /* Installed before playback. */ };
    const cleanup = (): void => {
      source.disconnect(); scaled?.disconnect(); forget(); endedSignal.abort();
      if (bed.src === source) { bed.src = undefined; bed.buf = undefined; }
    };
    const stop = (): void => {
      if (ended) return;
      ended = true;
      try { if (started) source.stop(); } finally { cleanup(); }
    };
    if (this.scope) {
      forget = this.scope.capture('sounds', stop);
      this.scope.listen(source, 'ended', () => { ended = true; cleanup(); }, { once: true, signal: endedSignal.signal });
    }
    try { loopAt(source, sample.buffer, sample, this.random, time); started = true; }
    catch (error) { stop(); throw error; }
    bed.src = source; bed.buf = sample.buffer; bed.quiet = 0; def.started(); return bed;
  }
  mix(def: ZoneBed, sample: SampleLoop | undefined, level: number, tau: number, threshold = 0.002): void {
    if (!this.audio.ready || this.scope?.disposed) return;
    let bed = this.beds.get(def.id);
    if (!bed) { if (!sample || level < threshold) return; bed = this.ensure(def); }
    const t = this.audio.ctx.currentTime;
    if (bed.src && (!sample || sample.buffer !== bed.buf)) {
      bed.src.stop(t + 1.2); bed.src = undefined; bed.buf = undefined; bed.gain.gain.setTargetAtTime(0, t, 0.3);
    }
    if (sample && !bed.src && level >= threshold) this.start(def, sample);
    bed.level = level; bed.gain.gain.setTargetAtTime(bed.src ? level : 0, t, tau);
  }
  silence(dt: number, after: number, threshold = 0.002): void {
    if (!this.audio.ready) return;
    for (const bed of this.beds.values()) {
      if (!bed.src) continue;
      bed.quiet = bed.level < threshold ? bed.quiet + dt : 0;
      if (bed.quiet > after) { bed.src.stop(this.audio.ctx.currentTime + 0.1); bed.src = undefined; bed.buf = undefined; }
    }
  }
  drop(id: string): void {
    const bed = this.beds.get(id); if (!bed) return;
    bed.src?.stop(); bed.gain.disconnect(); bed.pan?.disconnect(); this.beds.delete(id);
  }
  dispose(): void { for (const id of this.beds.keys()) this.drop(id); }
}

/** A point port. */
export interface MixPoint { readonly x: number; readonly y?: number; readonly z: number }

/** What the profile hands the mix: its random stream (the synth pool and the one-shots draw from it), its scope's name,
 *  the ground and the sea, objects bounds ports read, point lists for nearness, fixed points and scalar readers. */
export interface AmbienceMixPorts {
  readonly random: () => number;
  readonly scope: string | Scope;
  readonly zoneScope?: Scope;
  readonly observe?: (values: Map<string,number>, dt:number) => boolean;
  readonly listener?: (x:number,y:number,z:number,yaw:number) => void;
  readonly diagnostic?: (id:string,value:number) => void;
  readonly roomWeight?: (id:string,value:number) => void;
  readonly afterLevels?: () => void;
  readonly sample?: { available:()=>boolean; load:(id:string)=>Promise<SampleLoop|undefined>; drop:(id:string)=>void };
  readonly sampleLive?: (ids:string[])=>void;
  readonly onZone?: (zone:string)=>void;
  readonly stereoTargets?: ()=>readonly (readonly [string,number,number])[];
  readonly heightAt: (x: number, z: number) => number;
  readonly sea: number;
  readonly objects?: Readonly<Record<string, object | null | undefined>>;
  readonly near?: Readonly<Record<string, readonly { x: number; z: number }[] | undefined>>;
  readonly points?: Readonly<Record<string, MixPoint>>;
  readonly inputs?: Readonly<Record<string, () => number>>;
  /** runs first in the build (e.g. the profile's synth bed hands over to the zoned graph) */
  readonly onBuild?: () => void;
}

type MixRoomRow = AudioAmbienceRouting['rooms']['list'][number];
const BOUNDS_KEYS = ['x', 'z', 'r', 'yMin', 'yMax'] as const;

/** Builds and runs a profile's mix from rows. */
export class AmbienceMix {
  /** 0 = day … 1 = night (the clock drives it) */
  night = 0;
  /** the dominant zone */
  zone: string;
  /** the live mix, refreshed at the tick rate (the same object, keys in row order) */
  readonly diag: Record<string, number> = {};
  /** the one-shot schedulers and anything the profile registers: disposed with the profile */
  readonly scope: Scope;
  /** the profile's zoned beds */
  readonly zones: AmbienceZones;
  private readonly mixPorts:Parameters<typeof evaluateAudioMix>[1];
  private readonly inputRows:readonly [string,()=>number][];
  private readonly readValue=(id:string):number=>this.value(id);
  private readonly readLevel=(id:string):number=>requireAudioLevel(this.profile.levels,id);
  private readonly roomDefs = new Map<string,MixRoomRow>();
  private readonly zoneNames = new Map<string,string>();
  private mixTime=0;
  private readonly audio: Audio;
  private readonly profile: AudioZoneProfile;
  private readonly rows: AudioAmbienceRouting;
  private readonly ports: AmbienceMixPorts;
  private readonly synth: ReturnType<Audio['createSynthBeds']>;
  private readonly marks:Record<string,()=>void>={};
  private readonly values = new Map<string, number>();
  private nodes = new Map<string, AudioNode>();
  private readonly nodePorts:Record<string,AudioNode>={};
  private readonly nodeRows:NonNullable<AudioZoneProfile['nodes']>;
  private panners = new Map<string, PannerNode>();
  private filters = new Map<string, BiquadFilterNode>();
  private readonly shores = new Map<string, Float32Array>();
  private readonly sends = new Map<string, GainNode>();
  private pans = new Map<string, StereoPannerNode>();
  private sendIn: GainNode | undefined;
  private built = false; private warming = false; private mixed = false;
  private underwater = false;
  private tick = 0; private t = 0; private mixDt=0; private active=true;
  private readonly samples=new Map<string,{pending:boolean;idle:number;heard:boolean}>();
  private readonly sampleDefs=new Map<string,ZoneBed>();
  private readonly q = new Float32Array(2);

  constructor(audio: Audio, profile: AudioZoneProfile, ports: AmbienceMixPorts, zone: string) {
    this.audio = audio; this.profile = profile; const rows=requireAudioProfile(profile.routing,'ambience routing');this.rows = rows; this.ports = ports; this.zone = zone;
    this.nodeRows=requireAudioProfile(profile.nodes,'ambience nodes');if(this.nodeRows.length>64)throw new Error('Audio node capacity');
    const schedules=profile.schedules??[];
    if(schedules.length>32)throw new Error('Ambient schedule capacity');
    for(let i=0;i<32;i++){const row=schedules[i];if(row!==undefined)this.marks[row.mark]=()=>{this.scheduleOneShot(row);};}
    this.inputRows=Object.entries(ports.inputs??{});
    if(rows.rooms.list.length>16||rows.zoneNames.length>32||rows.steer.length>32||this.inputRows.length>64)throw new Error('Ambience port rows exceed their bound');
    for(let i=0;i<16;i++){const room=rows.rooms.list[i];if(room!==undefined)this.roomDefs.set(room.id,room);}
    for(let i=0;i<32;i++){const id=rows.zoneNames[i];if(id!==undefined)this.zoneNames.set(id,id);}
    this.mixPorts = {
      read:id=>this.value(id),write:(id,value)=>{this.values.set(id,value);},
      level:(id,value)=>{this.level(id,value);},
      afterLevels:()=>{
        const mixture=this.rows,a=this.audio,t=this.mixTime;
        this.panSamples();this.ports.afterLevels?.();
    for (let index=0;index<32;index++) {
      const s=mixture.steer[index];if(s===undefined)continue;
      const p = this.pans.get(s.pan), pd = this.value(`${s.toward}.sum`);
      if (!p || !(pd > 0)) continue;
      const pdx = this.value(`${s.toward}.dx`), pdz = this.value(`${s.toward}.dz`), rx = -a.ctx.listener.forwardZ.value, rz = a.ctx.listener.forwardX.value;
      p.pan.setTargetAtTime(Math.max(-s.width, Math.min(s.width, (pdx * rx + pdz * rz) / (Math.hypot(pdx, pdz) + 1e-3) * s.width)), t, s.tau);
    }
      },
      cutoff:(id,value)=>{this.filters.get(id)?.frequency.setTargetAtTime(value,this.mixTime,this.profile.smoothSeconds);},
      room:(id,weight,level)=>{const room=this.roomDefs.get(id);if(room===undefined)throw new Error('Unknown ambience room');const gain=weight>0.001?this.send(room):this.sends.get(id);gain?.gain.setTargetAtTime(level,this.mixTime,this.profile.smoothSeconds);this.ports.roomWeight?.(id,weight);},
      diag:(id,value)=>{this.diag[id]=value;this.ports.diagnostic?.(id,value);},
      shade:(gain,cutoff)=>{this.audio.shadeAmbient(gain,cutoff);},
    };
    this.scope = typeof ports.scope==='string'?new Scope(ports.scope):ports.scope;
    this.zones = new AmbienceZones(audio, audioRandom,ports.zoneScope);
    this.synth = audio.createSynthBeds(this.zones, ports.random);
    const diag=requireAudioProfile(profile.mix,'ambience.mix').diag;
    for(let i=0;i<64;i++){const row=diag[i];if(row!==undefined)this.diag[row[0]]=0;}
    for (const z of profile.zones) for (const k of ['x', 'z', 'inner', 'outer', 'gain'] as const) this.values.set(`${z.id}.${k}`, z[k]);
    for (const [k, v] of Object.entries(profile.levels)) this.values.set(`level.${k}`, v);
    for (const [k, v] of Object.entries(profile.wet)) this.values.set(`wet.${k}`, v);
    for (const [id, p] of Object.entries(ports.points ?? {})) { this.values.set(`${id}.x`, p.x); this.values.set(`${id}.z`, p.z); if (p.y !== undefined) this.values.set(`${id}.y`, p.y); }
    this.values.set('sea', ports.sea);
    for(const row of rows.samples?.beds??[])this.sampleDefs.set(row.id,{id:row.id,panned:row.panned,out:()=>this.node(row.out),started:()=>{tap.sound?.(`${rows.samples?.tap}${row.id}`);}});
    for (let index=0;index<64;index++){const n=this.nodeRows[index];if(n?.follow) this.shores.set(n.id, this.traceShore(n.follow.zone, n.follow.rays, n.follow.step, n.follow.refine));}
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
    if(this.rows.listener==='context')this.ports.onBuild?.();
    if(rows.underwater){const [cutoff,ramp]=rows.underwater;a.underwaterCutoff=cutoff;a.underwaterRamp=ramp;}
    if(rows.listener==='context')a.voices.prewarm([...rows.prewarm]);
    this.nodePorts['ambient']=a.ambient;this.nodePorts['world']=a.world;this.nodePorts['sfx']=a.sfx;
    const made=this.synth.nodes(this.nodeRows,this.nodePorts,this.rows.listener==='port'?this.readLevel:this.readValue);
    this.nodes=made.nodes;this.filters=made.filters;this.panners=made.panners;
    const outs: Record<string, AudioNode> = Object.fromEntries(this.nodes);
    if(this.profile.graph)this.pans=this.synth.assemble(this.profile.graph,outs,this.marks).pans;
    if(rows.rooms.input){const input=this.node(rows.rooms.input);if(!(input instanceof GainNode))throw new Error('Ambience room input must be a gain');this.sendIn=input;}
    else {const sendIn=c.createGain();sendIn.gain.value=1;this.node(rows.rooms.from).connect(sendIn);this.sendIn=sendIn;}
    if(this.rows.listener==='port'){a.voices.prewarm([...rows.prewarm]);this.ports.onBuild?.();}
  }

  /** a room's send (and convolver), built the first time it is needed */
  private send(room: MixRoomRow): GainNode | undefined {
    const have = this.sends.get(room.id); if (have) return have;
    const g=this.synth.reverb(room.ir,this.sendIn,()=>this.node(this.rows.rooms.to),this.rows.rooms.prewarmMissing??false);if(g===undefined)return undefined;
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
    if (!this.active || !a.ready) return;
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
    if(this.rows.listener==='context'){const l=a.ctx.listener;
    l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    l.forwardX.value = -m[8]; l.forwardY.value = -m[9]; l.forwardZ.value = -m[10];
    l.upX.value = m[4]; l.upY.value = m[5]; l.upZ.value = m[6];
    a.voices.setListener(x,y,z,Math.atan2(m[8],m[10]));}
    this.ports.listener?.(x,y,z,Math.atan2(m[8],m[10]));
    for (let index=0;index<64;index++) {
      const n=this.nodeRows[index];if(n===undefined)continue;
      const shore = this.shores.get(n.id), p = this.panners.get(n.id);
      if (!shore || !n.follow) continue;
      const d = this.nearest(shore, x, z, this.q);
      if (p) { p.positionX.value = this.q[0] ?? 0; p.positionY.value = this.ports.sea; p.positionZ.value = this.q[1] ?? 0; }
      this.diag[n.follow.diag] = d; this.values.set(n.follow.diag, d);
    }
    this.tick += dt;
    if (this.tick >= 1 / this.profile.tickHz) {this.mixDt=this.tick;this.tick=0;this.mix();}
  }

  /** head under / over the surface: the mix runs at once */
  setUnderwater(on: boolean): void { this.underwater = on; if(this.active&&this.built){this.mixDt=0;this.mix();} }

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
    if(this.rows.listener==='context')V.set('ground',this.ports.heightAt(x,z));
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
    if(this.ports.observe?.(V,this.mixDt)===false)return;
    this.mixTime=t;
    const selected=evaluateAudioMix(requireAudioProfile(this.profile.mix,'ambience.mix'),this.mixPorts);
    this.ports.sampleLive?.((this.profile.mix?.levels??[]).map(([id])=>id).filter(id=>this.samples.has(id)&&this.zones.beds.get(id)?.src!==undefined));
    const zone=requireAudioProfile(this.zoneNames.get(selected),'ambience.zone');if(zone!==this.zone){this.zone=zone;this.ports.onZone?.(zone);}
    this.mixed = true;
  }

  private level(id:string,value:number):void {
    const def=this.sampleDefs.get(id),port=this.ports.sample,t=this.mixTime;
    let bed=this.zones.beds.get(id),state=this.samples.get(id);
    const w=def?(Number.isFinite(value)?value:0):value;
    if(def&&port&&!bed&&w>0.01&&port.available()){
      bed=this.zones.ensure(def);state={pending:true,idle:0,heard:false};this.samples.set(id,state);
      const owned=bed,pending=state;
      void port.load(id).then(sample=>{
        pending.pending=false;
        if(!sample||this.zones.beds.get(id)!==owned){if(!sample)audioLog('bed',id,false,'will not decode');return undefined;}
        this.zones.start(def,sample,this.audio.ctx.currentTime+(this.rows.samples?.startDelay??0),sample.gain*requireAudioLevel(this.profile.levels,id));
        audioLog('bed',id,true,'loop in');return undefined;
      });
    }
    if(!bed)return;
    bed.level=w;bed.gain.gain.setTargetAtTime(w,t,this.profile.smoothSeconds);
    if(state){
      if(!state.heard&&w>0.05){state.heard=true;audioLog('bed',id,bed.src!==undefined,`up ${w.toFixed(2)}${state.pending?' (decoding)':''}`);}
      else if(state.heard&&w<0.02){state.heard=false;audioLog('bed',id,true,'down');}
      state.idle=w>0.005?0:state.idle+this.mixDt;
      if(state.idle>this.profile.silentSeconds&&!state.pending)this.dropSample(id);
    }
  }
  /** Drop only this owner's lazy sample loops; the shared mixer's buses retain their native owner. */
  get ready():boolean {return this.built;}
  dropSamples():void {for(const id of this.samples.keys())this.dropSample(id);}
  private dropSample(id:string):void {this.zones.drop(id);this.samples.delete(id);this.ports.sample?.drop(id);}
  private panSamples():void {
    const x=this.value('x'),z=this.value('z'),l=this.audio.ctx.listener;
    for(const [id,px,pz] of this.ports.stereoTargets?.()??[]){
      const bed=this.zones.beds.get(id);if(!bed?.pan)continue;
      const dx=px-x,dz=pz-z,d=Math.hypot(dx,dz),u=Math.max(0,Math.min(1,(d-4)/16)),fade=u*u*(3-2*u);
      bed.pan.pan.setTargetAtTime(d>1?Math.max(-0.75,Math.min(0.75,(dx*-l.forwardZ.value+dz*l.forwardX.value)/d*0.75*fade)):0,this.mixTime,0.2);
    }
  }
  /** Entered-owner bus gating; decoded beds are released before another cell borrows the buses. */
  setActive(on:boolean):void {
    if(this.active===on)return;this.active=on;
    if(!on){this.dropSamples();this.ports.sampleLive?.([]);}
    if(!this.built)return;const time=this.audio.ctx.currentTime;
    for(const [id,value] of this.rows.activeGains??[]){const node=this.node(id);if(!(node instanceof GainNode))throw new Error('Active audio bus must be a gain');node.gain.cancelScheduledValues(time);node.gain.setValueAtTime(on?(typeof value==='number'?value:requireAudioLevel(this.profile.levels,value)):0,time);}
    for(const [id,send] of this.sends){send.gain.cancelScheduledValues(time);send.gain.setValueAtTime(0,time);this.ports.roomWeight?.(id,0);}
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
