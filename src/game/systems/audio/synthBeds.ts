import type { AmbienceZones } from '@wildshard/engine/audio/ambience';
import { ownAudioSource } from '@wildshard/engine/audio/ownership';
import type { FamilyName } from '@wildshard/engine/audio/Voices';
import { tap } from '@wildshard/engine/core/harnessTap';

/**
 * Synth ambience beds as rows (SHARD-PLATFORM M3): a zoned soundscape's continuous beds built from a graph described as
 * data, no samples beyond the procedural bank's noise loops. Each bed is a named gain in the profile's AmbienceZones (its
 * `out` another bed or a node the caller names: an occlusion filter, a panner, a bus); each chain is a source (a looping
 * noise from a small pool — two white, two pink, each fanning out to several chains —, an oscillator or a sampled loop),
 * a run of biquad filters, gain stages (each with LFOs on its gain and an optional noise-driven flutter) and an optional
 * stereo panner the caller can steer, feeding one bed. Filter frequencies can wander on their own LFOs. The pool draws
 * `random()` in chain order, so the same rows always build the same graph. Nothing here knows a shard.
 *
 *   const beds = new SynthBeds(audio, zones, Math.random);   // nothing touches audio.ctx until assemble()
 *   const { pans } = beds.assemble(ROWS, { occl, ambient: audio.ambient, surfPan }, { swell: () => scheduleSwell() });
 */

/** A biquad: its type, frequency (Hz) and Q (default 0.7). */
export type SynthFilterRow = readonly [BiquadFilterType, number, number?];

/** An LFO summed onto a parameter: rate (Hz), depth (the parameter's units) and waveform (default sine). */
export interface SynthLfoRow {
  readonly rate: number;
  readonly depth: number;
  readonly type?: OscillatorType;
}

/** A gain stage after the filters: its level, LFOs on that level and a flutter (a noise through filters, × depth, onto it). */
export interface SynthStageRow {
  readonly gain: number;
  readonly lfos?: readonly SynthLfoRow[];
  readonly flutter?: { readonly noise: SynthNoise; readonly filters: readonly SynthFilterRow[]; readonly depth: number };
}

/** A pooled looping noise. */
export type SynthNoise = 'noise-white' | 'noise-pink';

/** One chain into a bed: exactly one of noise / osc (Hz) / sample, then filters, stages and an optional named panner. */
export interface SynthChainRow {
  readonly noise?: SynthNoise;
  readonly osc?: number;
  readonly sample?: FamilyName;
  readonly filters?: readonly SynthFilterRow[];
  /** LFOs on a filter's frequency: its index in `filters`, then the LFO */
  readonly sweeps?: readonly (readonly [number, SynthLfoRow])[];
  readonly stages?: readonly SynthStageRow[];
  /** a stereo panner after the stages, returned under this name for the caller to steer */
  readonly pan?: string;
  /** the bed it feeds */
  readonly to: string;
}

/** A bed: its id in the zones, where it goes (another bed's id or a caller-named node) and its starting level (default 0). */
export interface SynthBedRow {
  readonly id: string;
  readonly out: string;
  readonly gain?: number;
}

/** A mark among the chains: the caller's `marks[mark]` runs at that point of the build (a scheduler whose first draw from
 *  the shared random stream must stay in its place). */
export interface SynthMarkRow {
  readonly mark: string;
}

/** A synth bed graph: its beds (in order: a bed's `out` bed comes first), its chains (and marks) and the tap's id prefix. */
export interface SynthBedGraph {
  readonly tap: string;
  readonly beds: readonly SynthBedRow[];
  readonly chains: readonly (SynthChainRow | SynthMarkRow)[];
}

/** The bank the beds draw their noise and loops from (an engine Voices). */
export interface SynthBank {
  readonly buffer: (name: FamilyName) => AudioBuffer | undefined;
}

/** Where the beds are built: the audio context (read only when building, so nothing creates it before the first gesture)
 *  and the bank (an engine Audio). */
export interface SynthHost {
  readonly ctx: AudioContext;
  readonly voices: SynthBank;
}

/** Builds synth bed graphs into a profile's AmbienceZones; one pool of noise sources per instance. */
export class SynthBeds {
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
    const list = name === 'noise-white' ? this.poolW : this.poolP;
    this.poolN++;
    if (list.length >= 2) return list[this.poolN % 2];
    const buf = this.host.voices.buffer(name); if (!buf) return undefined;
    const c = this.ctx, s = ownAudioSource(c.createBufferSource()); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.97 + this.random() * 0.06;
    s.start(c.currentTime, this.random() * buf.duration);
    list.push(s);
    return s;
  }

  /** a biquad filter */
  biquad(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }

  /** an LFO summed onto `param` */
  lfo(row: SynthLfoRow, param: AudioParam): OscillatorNode {
    const c = this.ctx, o = ownAudioSource(c.createOscillator()); o.type = row.type ?? 'sine'; o.frequency.value = row.rate;
    const g = c.createGain(); g.gain.value = row.depth; o.connect(g).connect(param); o.start();
    return o;
  }

  /** assembles the graph: the beds, then every chain (and mark) in order; returns the named panners */
  assemble(graph: SynthBedGraph, outs: Readonly<Record<string, AudioNode>>, marks: Readonly<Record<string, () => void>> = {}): { readonly pans: Map<string, StereoPannerNode> } {
    const beds = new Map<string, GainNode>(), pans = new Map<string, StereoPannerNode>();
    const target = (id: string): AudioNode => {
      const node = beds.get(id) ?? outs[id];
      if (node === undefined) throw new Error(`synthBeds: no bed or output '${id}'`);
      return node;
    };
    for (const b of graph.beds) {
      const out = target(b.out);
      tap.sound?.(`${graph.tap}:${b.id}`);
      const gain = this.zones.ensure({ id: b.id, out: () => out, started: () => { /* no sampled loop: a synth bed's gain */ } }).gain;
      if (b.gain !== undefined) gain.gain.value = b.gain;
      beds.set(b.id, gain);
    }
    for (const ch of graph.chains) {
      if ('mark' in ch) marks[ch.mark]?.();
      else this.chain(ch, target(ch.to), pans);
    }
    return { pans };
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
    if (ch.osc !== undefined) { const o = ownAudioSource(c.createOscillator()); o.frequency.value = ch.osc; o.start(); return o; }
    if (ch.sample !== undefined) {
      const b = this.host.voices.buffer(ch.sample); if (!b) return undefined;
      const s = ownAudioSource(c.createBufferSource()); s.buffer = b; s.loop = true; s.start(c.currentTime, this.random() * b.duration);
      return s;
    }
    return undefined;
  }
}
