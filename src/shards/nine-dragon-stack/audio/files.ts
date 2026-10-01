import { loadAudio, type SetScore, type ScoreSource, type LevelAudioProfile, type MusicState } from '#engine';

export const SCORE_SET = { dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack' };
export const SFX_SET = 'nine-dragon-stack';
export async function createNdAudio(): Promise<LevelAudioProfile> {
  const { musicManifest, shipped, scoreFiles, cueFiles, MUSIC_STYLES, decodeStyle, decodeScore, decodeCueSet } = await loadAudio();
  const titleFiles = (style: Parameters<LevelAudioProfile['bootFiles']>[0]): string[] => {
    const title = musicManifest(style)?.slots['title'];
    return title ? [`/assets/music/${style}/${title.calm}`].filter(shipped) : [];
  };
  return {
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
}
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const [{ getMusicStyle }, profile] = await Promise.all([loadAudio(), createNdAudio()]);
  return profile.bootFiles(getMusicStyle());
}
export interface NdScene { well: number }
export function ndPick(scene: NdScene, state: MusicState | undefined): readonly string[] {
  return [state?.mode === 'combat' ? 'nd-fight' : scene.well > 0.5 ? 'nd-well' : 'nd-market', 'nd-market'];
}
export async function ndScore(onReady: () => void): Promise<SetScore<NdScene> & ScoreSource> {
  const { SetScore, cachedBytes, decodeBytes } = await loadAudio();
  return new SetScore<NdScene>({ ...SCORE_SET, scene: { well: 0 }, pick: ndPick, read: cachedBytes, decode: decodeBytes, onReady, waitForBank: true });
}
