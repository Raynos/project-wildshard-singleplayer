import { SetScore, scoreFiles, decodeScore, type ScoreSource } from '#engine/audio/SetScore';
import { musicManifest, decodeStyle, shipped } from '#engine/audio/Stems';
import { cueFiles, decodeCueSet } from '#engine/audio/Cues';
import type { LevelAudioProfile } from '#engine/audio/levelAudio';
import { MUSIC_STYLES, getMusicStyle, type MusicStyle } from '#engine/ui/Settings';
import { cachedBytes, decodeBytes } from '#engine/audio/preload';
import type { MusicState } from '#engine/audio/Music';

export const SCORE_SET = { dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack' };
export const SFX_SET = 'nine-dragon-stack';
function titleFiles(style: MusicStyle): string[] {
  const title = musicManifest(style)?.slots['title'];
  return title ? [`/assets/music/${style}/${title.calm}`].filter(shipped) : [];
}
export const BOOT_AUDIO = (): readonly string[] => [...titleFiles(getMusicStyle()), ...scoreFiles(SCORE_SET, ['nd-market']), ...cueFiles(SFX_SET)];
export const ND_AUDIO: LevelAudioProfile = {
  files: () => ({ music: [...MUSIC_STYLES.flatMap(titleFiles), ...scoreFiles(SCORE_SET)], sfx: cueFiles(SFX_SET) }),
  bootFiles: (style) => [...titleFiles(style), ...scoreFiles(SCORE_SET, ['nd-market']), ...cueFiles(SFX_SET)],
  decode: async (style, read, decode, onFile) => {
    const [title, score, cues] = await Promise.all([
      decodeStyle(style, ['title'], read, decode, onFile, 'base', []).catch(() => undefined),
      decodeScore(SCORE_SET, ['nd-market'], read, decode, true, onFile),
      decodeCueSet(SFX_SET, read, decode, onFile),
    ]);
    return { title, score, cues };
  },
};
export interface NdScene { well: number }
export function ndPick(scene: NdScene, state: MusicState | undefined): readonly string[] {
  return [state?.mode === 'combat' ? 'nd-fight' : scene.well > 0.5 ? 'nd-well' : 'nd-market', 'nd-market'];
}
export function ndScore(onReady: () => void): SetScore<NdScene> & ScoreSource {
  return new SetScore<NdScene>({ ...SCORE_SET, scene: { well: 0 }, pick: ndPick, read: cachedBytes, decode: decodeBytes, onReady, waitForBank: true });
}
