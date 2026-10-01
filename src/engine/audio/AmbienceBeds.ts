import { AmbienceZones } from './ambience';
import { loopAt } from './util';
import type { SampleLoop } from './Audio';
import type { AudioMixer } from './levelAudio';
import type { Scope } from '../app/scope';
import type { Vector3 } from 'three';

interface LoopVoice { gain: GainNode; pan: StereoPannerNode; stop: () => void }
function loopVoice(audio: AudioMixer, sample: SampleLoop, scope: Scope, random: () => number): LoopVoice {
  const ctx = audio.ctx, source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
  gain.gain.value = 0;
  source.connect(gain).connect(pan).connect(audio.bus('ambience'));
  let started = false, stopped = false;
  let forget = (): void => { /* Installed below before playback. */ };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    try { if (started) source.stop(); }
    finally { source.disconnect(); gain.disconnect(); pan.disconnect(); forget(); }
  };
  forget = scope.capture('sounds', stop);
  try { loopAt(source, sample.buffer, sample, random, ctx.currentTime); started = true; }
  catch (error) { stop(); throw error; }
  return { gain, pan, stop };
}
export interface BedDef { id: string; zone: string; sample: () => SampleLoop | undefined; started: () => void }
export type ZoneWeights = Readonly<Record<string, number>>;
/** Zone weights fade N beds through the ambience bus without starting an audio device before a gesture. */
export class AmbienceBeds {
  private readonly zones: AmbienceZones;
  private readonly audio: AudioMixer;
  private readonly scope: Scope;
  private readonly beds: readonly BedDef[];
  private readonly weights: (pos: Vector3) => ZoneWeights;
  private readonly fade: number;
  constructor(audio: AudioMixer, scope: Scope, beds: readonly BedDef[], weights: (pos: Vector3) => ZoneWeights, fade: number, random: () => number) {
    this.audio = audio; this.scope = scope; this.beds = beds; this.weights = weights; this.fade = Math.max(0.05, fade);
    this.zones = new AmbienceZones(audio, random, scope);
  }
  update(pos: Vector3): void {
    if (!this.audio.ready || this.scope.disposed) return;
    const weights = this.weights(pos);
    for (const bed of this.beds) {
      const sample = bed.sample(); if (!sample) continue;
      this.zones.mix({ id: bed.id, panned: true, started: bed.started }, sample,
        sample.gain * Math.min(1, Math.max(0, weights[bed.zone] ?? 0)), this.fade / 3, -Infinity);
    }
  }
  get audible(): string[] { return [...this.zones.beds.keys()]; }
}
/** Select at most max nearest audible loops. Removed voices stop immediately and release their scope handles. */
export class PositionalLoops {
  private readonly voices = new Map<number, LoopVoice>();
  private readonly audio: AudioMixer;
  private readonly scope: Scope;
  private readonly points: readonly Vector3[];
  private readonly sample: () => SampleLoop | undefined;
  private readonly started: () => void;
  private readonly random: () => number;
  readonly max: number;
  readonly reach: number;
  constructor(audio: AudioMixer, scope: Scope, points: readonly Vector3[], sample: () => SampleLoop | undefined, started: () => void,
    random: () => number, max = 4, reach = 14) {
    this.audio = audio; this.scope = scope; this.points = points; this.sample = sample; this.started = started;
    this.random = random; this.max = max; this.reach = reach;
    scope.onDispose(() => { this.voices.clear(); });
  }
  update(pos: Vector3, yaw: number): void {
    if (!this.audio.ready || this.scope.disposed) return;
    const sample = this.sample();
    if (!sample) return;
    const nearest = this.points.map((point, index) => ({ point, index, distance: point.distanceTo(pos) }))
      .filter((p) => p.distance < this.reach).sort((a, b) => a.distance - b.distance).slice(0, this.max);
    const ids = new Set(nearest.map((p) => p.index));
    for (const [index, voice] of this.voices) if (!ids.has(index)) { voice.stop(); this.voices.delete(index); }
    const time = this.audio.ctx.currentTime;
    for (const { point, index, distance } of nearest) {
      let voice = this.voices.get(index);
      if (!voice) { voice = loopVoice(this.audio, sample, this.scope, this.random); this.voices.set(index, voice); this.started(); }
      const dx = point.x - pos.x, dz = point.z - pos.z;
      voice.pan.pan.setTargetAtTime(distance > 0.1 ? Math.min(1, Math.max(-1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance)) : 0, time, 0.1);
      voice.gain.gain.setTargetAtTime(sample.gain * 0.22 * (1 - distance / this.reach) ** 2, time, 0.2);
    }
  }
  get count(): number { return this.voices.size; }
}
