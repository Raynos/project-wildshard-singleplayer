import type { AudioData } from '@wildshard/format/audio';
import type { SfxBank } from './preload';
import type { VoicePool } from './Voices';
import type { MusicStyle } from '../ui/Settings';
import type { StyleBank } from './Stems';
import type { AudioRead, AudioDecode, ScoreBank } from './SetScore';
import type { CueBank } from './Cues';

export interface LevelAudioBank { title: StyleBank | undefined; score: ScoreBank; cues: CueBank; samples?: SfxBank }
/** Playback modules depend on the mixer port so they can be checked without a device or legacy content. */
export interface AudioMixer {
  voice: () => VoicePool;
  readonly ready: boolean;
  readonly ctx: BaseAudioContext;
  bus: (id: 'music' | 'ambience' | 'sfx' | 'voice' | 'ui') => GainNode;
}
/** Boot downloads and decodes this content profile through the same counted/deferred queue. */
export interface LevelAudioProfile {
  priorityFiles?: () => readonly string[];
  files: () => { music: string[]; sfx: string[] };
  bootFiles: (style: MusicStyle) => readonly string[];
  decode: (style: MusicStyle, read: AudioRead, decode: AudioDecode, onFile?: () => void) => Promise<LevelAudioBank>;
}

/** A level with no audio files leaves `audio.preload` out; boot uses this (no music, no SFX samples, nothing to decode). */
export const NO_AUDIO: LevelAudioProfile = {
  files: () => ({ music: [], sfx: [] }),
  bootFiles: () => [],
  decode: () => Promise.resolve({ title: undefined, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } }),
};

/** Optional trusted decode hook for an existing sprite catalogue; no playback or scheduling. */
export interface AudioCatalogueExtras {
  readonly files: () => readonly string[];
  readonly decode: (read: AudioRead, onFile?: () => void) => Promise<void>;
}
/** Declared download/decode routing over the existing music and sample catalogues.
 * Selected sets keep their original order; an overlay replaces matching samples
 * without changing recordings, gains, the decoder, sound clocks or randomness.
 */
export async function createCatalogueAudio(data: AudioData, extras?: AudioCatalogueExtras): Promise<LevelAudioProfile> {
  const samples = data.samples, music = data.music, policy = samples?.catalogue;
  if (samples === undefined || music === undefined || policy === undefined) throw new Error('Missing declared audio catalogue');
  const [{ audioFiles, musicDir, sfxDir }, { musicManifests, sfxManifests }, { getMusicStyle, getSfxSet }, { styleFiles, decodeStyle }, { sfxFiles, decodeSfxSet }] = await Promise.all([
    import('../boot/audioFiles'), import('../boot/tables'), import('../ui/Settings'), import('./Stems'), import('./preload'),
  ]);
  const levels = { loopGains: samples.loopGains };
  const ownMusic = (): string[] => {
    const genre = getMusicStyle(), key = `${samples.set}-${genre}`;
    return policy.ownMusic && genre !== 'synth' && Object.hasOwn(musicManifests(), key) ? [key] : [];
  };
  const ownSfx = (): string[] => Object.hasOwn(sfxManifests(), samples.set) ? [samples.set] : [];
  const selectedSfx = (): string[] => [...sfxFiles(getSfxSet(), samples.bed, levels),
    ...(policy.overlaySamples && getSfxSet() !== 'synth' ? sfxFiles(samples.set, samples.bed, levels) : []),
    ...(getSfxSet() === 'synth' ? [] : extras?.files() ?? [])];
  const decodeSamples = async (read: AudioRead, decode: AudioDecode, onFile?: () => void): Promise<SfxBank> => {
    if (!policy.overlaySamples) return decodeSfxSet(getSfxSet(), samples.bed, read, onFile, decode, levels);
    const set = getSfxSet(), [base, own] = await Promise.all([
      decodeSfxSet(set, samples.bed, read, onFile, decode, levels),
      decodeSfxSet(set === 'synth' ? 'synth' : samples.set, samples.bed, read, onFile, decode, levels),
    ]);
    const loops = new Map([...base.loops, ...own.loops]); base.loops.clear();
    for (const name of policy.loopOrder) { const loop = loops.get(name); if (loop) base.loops.set(name, loop); }
    for (const [id, loop] of loops) if (!base.loops.has(id)) base.loops.set(id, loop);
    for (const [id, shot] of own.shots) base.shots.set(id, shot);
    return base;
  };
  return {
    files: () => audioFiles({ omitSlots: policy.inventoryOmitSlots, musicSets: ownMusic(), sfxSets: ownSfx() }),
    ...(policy.priorityOwn ? { priorityFiles: () => {
      const files = audioFiles({ musicSets: ownMusic(), sfxSets: ownSfx() }), dirs = [...ownMusic().map(musicDir), ...ownSfx().map(sfxDir)];
      return [...files.music, ...files.sfx].filter(url => dirs.some(dir => url.startsWith(dir)));
    } } : {}),
    bootFiles: style => [...styleFiles(style, music.bootSlots), ...selectedSfx()],
    decode: async (style, read, decode, onFile) => {
      const [title, bank] = await Promise.all([
        decodeStyle(style, music.bootSlots, read, decode, onFile).catch(() => undefined), decodeSamples(read, decode, onFile),
        ...(getSfxSet() === 'synth' || extras === undefined ? [] : [extras.decode(read, onFile)]),
      ]);
      return { title, samples: bank, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
    },
  };
}
