import type { Scope } from '../app/scope';
import type { Audio } from './Audio';
import type { CombatCues, CombatCueOpts } from '../combat/cues';
import { createCueRouter, type CueRoute } from './cueRouting';
import type { AudioMusicProfile, AudioSampleProfile, AudioZoneProfile } from './audioProfiles';

/** Catalogue cue ids plus bounded wind recipes and a score mode, supplied as validated level data. */
export interface DeclaredAudioData {
  cues: readonly { id: string; voice: string }[];
  /** Extended profiles resolve only through trusted platform catalogue installers. */
  music?: AudioMusicProfile | undefined; samples?: AudioSampleProfile | undefined; zones?: AudioZoneProfile | undefined;
  /** Ordered cue rules resolve the same admitted voice catalogue, with scoped delayed playback. */
  routing?: readonly CueRoute[] | undefined;
  ambience: { bed: string; winds: readonly { frequency: number; q: number; pan: number; rate: number; gain: number }[] } | null;
  score: 'silent' | 'default';
}
/** Audio source lifetime and cue/score ports, independent of content packages and renderer state. */
export interface DeclaredAudioPorts {
  audio: Pick<Audio, 'installSynthBed' | 'restartSynthBed' | 'installCues'> & { mkWind: (...args: Parameters<Audio['mkWind']>) => Pick<GainNode, 'disconnect'> };
  cues: CombatCues;
  voices: ReadonlyMap<string, (opts: CombatCueOpts) => void>;
  /** the score's silence for a scope (`Music.silence`): the music bus at 0 while it lives, restored after */
  music: { silence: (scope: Scope) => void };
  scope: Scope;
  /** Trusted recipes consume bounded data; an unbound profile is refused before any sound changes. */
  profiles?: {
    music?: ((profile: AudioMusicProfile, scope: Scope) => void) | undefined;
    samples?: ((profile: AudioSampleProfile, scope: Scope) => void) | undefined;
    zones?: ((profile: AudioZoneProfile, scope: Scope) => void) | undefined;
  } | undefined;
}
/** Admit every voice before installing; route real engine cues and stop all bed sources with the level scope. */
export function installDeclaredAudio(data: DeclaredAudioData, ports: DeclaredAudioPorts): void {
  if (ports.scope.disposed) throw new Error('Audio scope is disposed');
  if ((data.music !== undefined && ports.profiles?.music === undefined) || (data.samples !== undefined && ports.profiles?.samples === undefined) || (data.zones !== undefined && ports.profiles?.zones === undefined)) throw new Error('Audio profile requires its trusted catalogue installer');
  const voices = new Map(data.cues.map((cue) => {
    const voice = ports.voices.get(cue.voice); if (voice === undefined) throw new Error(`Unknown catalogue voice: ${cue.voice}`);
    return [cue.id, voice] as const;
  }));
  if (voices.size !== data.cues.length) throw new Error('Duplicate audio cue');
  const routes = data.routing ?? [], routingPorts = {
    voices: new Map([...ports.voices].map(([id, voice]) => [id, (opts: CombatCueOpts): boolean => { voice(opts); return true; }])),
    later: (run: () => void, seconds: number) => { ports.scope.timeout(seconds * 1000, run); },
  };
  const combatRoutes = routes.filter((route) => route.bus !== 'audio'), audioRoutes = routes.filter((route) => route.bus === 'audio');
  const combatRouting = createCueRouter(combatRoutes, routingPorts), audioRouting = createCueRouter(audioRoutes, routingPorts);
  ports.cues.use((id, opts) => { const voice = voices.get(id); if (voice === undefined) return false; voice(opts); return true; }, ports.scope);
  if (combatRoutes.length > 0) ports.cues.use(combatRouting, ports.scope);
  if (audioRoutes.length > 0) ports.audio.installCues(audioRouting, ports.scope);
  if (data.music !== undefined) ports.profiles?.music?.(data.music, ports.scope);
  if (data.samples !== undefined) ports.profiles?.samples?.(data.samples, ports.scope);
  if (data.zones !== undefined) ports.profiles?.zones?.(data.zones, ports.scope);
  if (data.score === 'silent') ports.music.silence(ports.scope);
  if (data.ambience !== null) {
    const { bed, winds } = data.ambience; let sources: Pick<GainNode, 'disconnect'>[] = [];
    const stop = (): void => { for (const source of sources) source.disconnect(); sources = []; };
    ports.audio.installSynthBed(bed, { start: () => { stop(); sources = winds.map((wind) => ports.audio.mkWind(wind.frequency, wind.q, wind.pan, wind.rate, wind.gain)); }, stop }, ports.scope);
    ports.audio.restartSynthBed(bed); ports.scope.onDispose(stop);
  }
}
