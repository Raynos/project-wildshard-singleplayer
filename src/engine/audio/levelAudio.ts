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
  files: () => { music: string[]; sfx: string[] };
  bootFiles: (style: MusicStyle) => readonly string[];
  decode: (style: MusicStyle, read: AudioRead, decode: AudioDecode, onFile?: () => void) => Promise<LevelAudioBank>;
}
