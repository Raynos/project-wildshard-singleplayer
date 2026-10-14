import { ownAudioSource } from './ownership';
import type { AmbienceZones } from './ambience';
import type { AudioPhraseProgram, AudioMixExpr, SynthNoise, SynthLfoRow, SynthChainRow, SynthBedGraph } from '@wildshard/format/audioProfiles';
import { audioMixValue } from './audioProfiles';
import { tap } from '../core/harnessTap';
import { audioRandom } from './util';

/** Shared WebAudio oscillator/noise/envelope blocks; content owns sound ids. */
export abstract class Synth {
  abstract readonly ctx: AudioContext;
  abstract readonly sfx: GainNode;
  abstract readonly ready: boolean;
  protected abstract readonly noise: AudioBuffer;
  env(g: GainNode, t: number, peak: number, attack: number, decay: number, hold = 0): void {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }

  /** filtered noise burst */
  burst(opts: { t?: number; type?: BiquadFilterType; freq: number; freqEnd?: number; q?: number; gain: number; attack?: number; decay: number; hold?: number; pan?: number; out?: AudioNode; rate?: number }): GainNode {
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const src = ownAudioSource(c.createBufferSource()); src.buffer = this.noise; src.loop = true; src.playbackRate.value = opts.rate ?? 1;
    src.start(t, audioRandom() * 1.5);
    const f = c.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.setValueAtTime(opts.freq, t); f.Q.value = opts.q ?? 1;
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + (opts.attack ?? 0.002) + opts.decay);
    const g = c.createGain(); this.env(g, t, opts.gain, opts.attack ?? 0.002, opts.decay, opts.hold);
    const dur = (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.05;
    src.stop(t + dur);
    src.connect(f).connect(g);
    this.route(g, opts.pan ?? 0, opts.out);
    return g;
  }

  /** oscillator with pitch glide */
  tone(opts: { t?: number; type?: OscillatorType; f0: number; f1?: number; glide?: number; gain: number; attack?: number; decay: number; hold?: number; pan?: number; out?: AudioNode; vibrato?: { rate: number; depth: number }; lowpass?: number }): GainNode {
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const o = ownAudioSource(c.createOscillator()); o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t + (opts.glide ?? opts.decay));
    if (opts.vibrato) {
      const lfo = ownAudioSource(c.createOscillator()); lfo.frequency.value = opts.vibrato.rate;
      const lg = c.createGain(); lg.gain.value = opts.vibrato.depth;
      lfo.connect(lg).connect(o.frequency); lfo.start(t);
      lfo.stop(t + (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.1);
    }
    const g = c.createGain(); this.env(g, t, opts.gain, opts.attack ?? 0.002, opts.decay, opts.hold);
    let node: AudioNode = o;
    if (opts.lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; node.connect(f); node = f; }
    node.connect(g);
    o.start(t); o.stop(t + (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.05);
    this.route(g, opts.pan ?? 0, opts.out);
    return g;
  }

  /** Play validated ordered phrase rows with the existing tone/burst envelopes and owned bus routing. */
  playPhrase(program:AudioPhraseProgram,out:AudioNode,params:Readonly<Record<string,number>>={},random:()=>number=audioRandom):void {
    const values=new Map(Object.entries(params)),nodes=new Map<string,AudioNode>([['out',out]]);
    values.set('t',this.ctx.currentTime);
    const read=(id:string):number=>{if(id==='random')return random();const value=values.get(id);if(value===undefined)throw new Error(`Missing phrase value: ${id}`);return value;};
    const value=(expr:AudioMixExpr):number=>{const result=audioMixValue(expr,read);if(!Number.isFinite(result))throw new Error('Nonfinite phrase value');return result;};
    const target=(id:string):AudioNode=>{const node=nodes.get(id);if(node===undefined)throw new Error(`Missing phrase output: ${id}`);return node;};
    let work=0;
    type Step=AudioPhraseProgram['steps'][number];
    const run=(step:Exclude<Step,{kind:'repeat'}>):void=>{
      if(++work>1024)throw new Error('Phrase work capacity');
      if(step.kind==='value'){values.set(step.id,value(step.value));return;}
      if(step.kind==='bus'){
        const bus=this.ctx.createGain();bus.gain.value=value(step.gain);let tail:AudioNode=bus;
        if(step.filter){const filter=this.ctx.createBiquadFilter();filter.type=step.filter.type;filter.frequency.value=value(step.filter.frequency);if(step.filter.q!==undefined)filter.Q.value=value(step.filter.q);bus.connect(filter);tail=filter;}
        this.route(tail,value(step.pan),target(step.out));nodes.set(step.id,bus);return;
      }
      if(step.kind==='tone'){
        const opts:Parameters<Synth['tone']>[0]={f0:value(step.f0),gain:value(step.gain),decay:value(step.decay),out:target(step.out)};
        if(step.type!==undefined)opts.type=step.type;
        for(const key of ['t','f1','glide','attack','hold','lowpass'] as const){const expr=step[key];if(expr!==undefined)opts[key]=value(expr);}
        if(step.vibrato)opts.vibrato={rate:value(step.vibrato.rate),depth:value(step.vibrato.depth)};
        this.tone(opts);return;
      }
      const opts:Parameters<Synth['burst']>[0]={freq:value(step.freq),gain:value(step.gain),decay:value(step.decay),out:target(step.out)};
      if(step.type!==undefined)opts.type=step.type;
      for(const key of ['t','freqEnd','q','attack','hold','rate'] as const){const expr=step[key];if(expr!==undefined)opts[key]=value(expr);}
      this.burst(opts);
    };
    for(const step of program.steps){
      if(step.kind!=='repeat'){run(step);continue;}
      const count=value(step.count);if(!Number.isInteger(count)||count<0||count>step.max)throw new Error('Phrase repeat capacity');
      for(let i=0;i<count;i++)for(const child of step.body)run(child);
    }
  }

  route(node: AudioNode, pan: number, out?: AudioNode): void {
    if (pan !== 0 && 'createStereoPanner' in this.ctx) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p).connect(out ?? this.sfx); }
    else node.connect(out ?? this.sfx);
  }

}

/** The bank the beds draw their noise and loops from (an engine Voices). */
export interface SynthBank {
  readonly buffer: (name: string) => AudioBuffer | undefined;
}

/** Where the beds are built: the audio context (read only when building, so nothing creates it before the first gesture)
 *  and the bank (an engine Audio). */
export interface SynthHost {
  readonly ctx: AudioContext;
  readonly noise: AudioBuffer;
  readonly voices: SynthBank;
}

/** Builds synth bed graphs into a profile's AmbienceZones; one pool of noise sources per instance. */
export class SynthBeds {
  /** Scheduled sources borrowed by the owning bed lifecycle. */
  readonly sources: AudioScheduledSourceNode[] = [];
  private readonly host: SynthHost;
  private readonly zones: AmbienceZones;
  private readonly random: () => number;
  private readonly poolW: AudioBufferSourceNode[] = [];
  private readonly poolP: AudioBufferSourceNode[] = [];
  private poolN = 0;

  constructor(host: SynthHost, zones: AmbienceZones, random: () => number) {
    this.host = host; this.zones = zones; this.random = random;
  }

  private get ctx(): AudioContext { return this.host.ctx; }

  /** a looping noise source from the pool (two of each kind; past that the pool alternates between them) */
  noise(name: SynthNoise): AudioBufferSourceNode | undefined {
    if (name === 'native-white') {
      const s = ownAudioSource(this.ctx.createBufferSource()); s.buffer = this.host.noise; s.loop = true; s.start(0, this.random()); this.sources.push(s); return s;
    }
    const list = name === 'noise-white' ? this.poolW : this.poolP;
    this.poolN++;
    if (list.length >= 2) return list[this.poolN % 2];
    const buf = this.host.voices.buffer(name); if (!buf) return undefined;
    const c = this.ctx, s = ownAudioSource(c.createBufferSource()); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.97 + this.random() * 0.06;
    s.start(c.currentTime, this.random() * buf.duration);
    list.push(s); this.sources.push(s);
    return s;
  }

  /** a biquad filter */
  biquad(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }

  /** an LFO summed onto `param` */
  lfo(row: SynthLfoRow, param: AudioParam): OscillatorNode {
    const c = this.ctx, o = ownAudioSource(c.createOscillator()); o.type = row.type ?? 'sine'; o.frequency.value = row.rate;
    const g = c.createGain(); g.gain.value = row.depth; this.sources.push(o); o.connect(g).connect(param); o.start();
    return o;
  }

  /** assembles the graph: the beds, then every chain (and mark) in order; returns the named panners */
  assemble(graph: SynthBedGraph, outs: Readonly<Record<string, AudioNode>>, marks: Readonly<Record<string, () => void>> = {}): { readonly pans: Map<string, StereoPannerNode>; readonly beds: Map<string, GainNode> } {
    const beds = new Map<string, GainNode>(), pans = new Map<string, StereoPannerNode>();
    const target = (id: string): AudioNode => {
      const node = beds.get(id) ?? outs[id];
      if (node === undefined) throw new Error(`synthBeds: no bed or output '${id}'`);
      return node;
    };
    for (const b of graph.beds) {
      const out = target(b.out);
      if (graph.tap !== undefined) tap.sound?.(`${graph.tap}:${b.id}`);
      const voice = this.zones.ensure({ id: b.id, panned: b.pan !== undefined, out: () => out, started: () => { /* no sampled loop: a synth bed's gain */ } });
      const gain = voice.gain;
      if (voice.pan && b.pan !== undefined) voice.pan.pan.value = b.pan;
      if (b.gain !== undefined) gain.gain.value = b.gain;
      beds.set(b.id, gain);
      for (const row of b.lfos ?? []) this.lfo(row, gain.gain);
    }
    for (const ch of graph.chains) {
      if ('mark' in ch) marks[ch.mark]?.();
      else this.chain(ch, target(ch.to), pans);
    }
    return { pans, beds };
  }

  private chain(ch: SynthChainRow, bed: AudioNode, pans: Map<string, StereoPannerNode>): void {
    const c = this.ctx;
    // the tail first (stages → panner → bed), then the source and its filters into its head
    let head: AudioNode = bed;
    if (ch.pan !== undefined) { const p = c.createStereoPanner(); p.connect(head); pans.set(ch.pan, p); head = p; }
    const stages = ch.stages ?? [];
    const gains: GainNode[] = [];
    for (let i = stages.length - 1; i >= 0; i--) { const g = c.createGain(); g.gain.value = stages[i]?.gain ?? 1; g.connect(head); gains.unshift(g); head = g; }
    const src = this.source(ch);
    const filters = (ch.filters ?? []).map(([type, f, q]) => this.biquad(type, f, q));
    let from: AudioNode | undefined = src;
    for (const f of filters) { from?.connect(f); from = src === undefined ? undefined : f; }
    from?.connect(head);
    for (const [i, row] of ch.sweeps ?? []) { const f = filters[i]; if (f) this.lfo(row, f.frequency); }
    for (const [i, st] of stages.entries()) {
      const g = gains[i]; if (!g) continue;
      for (const l of st.lfos ?? []) this.lfo(l, g.gain);
      if (st.flutter) {
        const n = this.noise(st.flutter.noise);
        if (n) {
          const d = c.createGain(); d.gain.value = st.flutter.depth;
          let at: AudioNode = n;
          for (const [type, f, q] of st.flutter.filters) at = at.connect(this.biquad(type, f, q));
          at.connect(d).connect(g.gain);
        }
      }
    }
  }

  private source(ch: SynthChainRow): AudioNode | undefined {
    const c = this.ctx;
    if (ch.noise !== undefined) return this.noise(ch.noise);
    if (ch.osc !== undefined) { const o = ownAudioSource(c.createOscillator()); o.frequency.value = ch.osc; o.start(); this.sources.push(o); return o; }
    if (ch.sample !== undefined) {
      const b = this.host.voices.buffer(ch.sample); if (!b) return undefined;
      const s = ownAudioSource(c.createBufferSource()); s.buffer = b; s.loop = true; s.start(c.currentTime, this.random() * b.duration); this.sources.push(s);
      return s;
    }
    return undefined;
  }
}
