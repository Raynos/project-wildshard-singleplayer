import type { SampleLoop } from './Audio';
import type { AudioMixer } from './levelAudio';
import type { Scope } from '../app/scope';
import { ownAudioSource } from './ownership';
import { loopAt } from './util';

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
    if (this.scope) {
      let ended = false;
      const forget = this.scope.capture('sounds', () => { if (!ended) source.stop(); source.disconnect(); scaled?.disconnect(); if (bed.src === source) bed.src = undefined; });
      this.scope.listen(source, 'ended', () => { ended = true; forget(); source.disconnect(); scaled?.disconnect(); }, { once: true });
    }
    loopAt(source, sample.buffer, sample, this.random, time);
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
