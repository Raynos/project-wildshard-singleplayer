import type { Scope } from '../app/scope';
import type { Audio } from './Audio';
import type { CombatCues, CombatCueOpts } from '../combat/cues';
import { createCueRouter, type CueRoute } from './cueRouting';

/** Catalogue cue ids plus bounded wind recipes and a score mode, supplied as validated level data. */
export interface DeclaredAudioData {
  cues: readonly { id: string; voice: string }[];
  /** Ordered cue rules resolve the same admitted voice catalogue, with scoped delayed playback. */
  routing?: readonly CueRoute[] | undefined;
  ambience: { bed: string; winds: readonly { frequency: number; q: number; pan: number; rate: number; gain: number }[] } | null;
  score: 'silent' | 'default';
}
/** Audio source lifetime and cue/score ports, independent of content packages and renderer state. */
export interface DeclaredAudioPorts {
  audio: Pick<Audio, 'installSynthBed' | 'restartSynthBed'> & { mkWind: (...args: Parameters<Audio['mkWind']>) => Pick<GainNode, 'disconnect'> };
  cues: CombatCues;
  voices: ReadonlyMap<string, (opts: CombatCueOpts) => void>;
  music: { readonly out: { readonly gain: Pick<AudioParam, 'value'> } };
  scope: Scope;
}
/** Admit every voice before installing; route real engine cues and stop all bed sources with the level scope. */
export function installDeclaredAudio(data: DeclaredAudioData, ports: DeclaredAudioPorts): void {
  if (ports.scope.disposed) throw new Error('Audio scope is disposed');
  const voices = new Map(data.cues.map((cue) => {
    const voice = ports.voices.get(cue.voice); if (voice === undefined) throw new Error(`Unknown catalogue voice: ${cue.voice}`);
    return [cue.id, voice] as const;
  }));
  if (voices.size !== data.cues.length) throw new Error('Duplicate audio cue');
  const routes = data.routing ?? [], routing = createCueRouter(routes, {
    voices: new Map([...ports.voices].map(([id, voice]) => [id, (opts: CombatCueOpts): boolean => { voice(opts); return true; }])),
    later: (run, seconds) => { ports.scope.timeout(seconds * 1000, run); },
  });
  ports.cues.use((id, opts) => { const voice = voices.get(id); if (voice === undefined) return false; voice(opts); return true; }, ports.scope);
  if (routes.length > 0) ports.cues.use(routing, ports.scope);
  if (data.score === 'silent') {
    const gain = ports.music.out.gain, before = gain.value; gain.value = 0;
    ports.scope.onDispose(() => { gain.value = before; });
  }
  if (data.ambience !== null) {
    const { bed, winds } = data.ambience; let sources: Pick<GainNode, 'disconnect'>[] = [];
    const stop = (): void => { for (const source of sources) source.disconnect(); sources = []; };
    ports.audio.installSynthBed(bed, { start: () => { stop(); sources = winds.map((wind) => ports.audio.mkWind(wind.frequency, wind.q, wind.pan, wind.rate, wind.gain)); }, stop }, ports.scope);
    ports.audio.restartSynthBed(bed); ports.scope.onDispose(stop);
  }
}
