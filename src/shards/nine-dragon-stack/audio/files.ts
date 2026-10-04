import type { LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import type { MusicState } from '@wildshard/engine/audio/Music';
import type { SetScore, ScoreSource } from '@wildshard/engine/audio/SetScore';

export const SCORE_SET = { dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack' };
export const SFX_SET = 'nine-dragon-stack';
export async function createNdAudio(): Promise<LevelAudioProfile> {
  const [{ musicManifest, shipped, decodeStyle }, { scoreFiles, decodeScore }, { cueFiles, decodeCueSet }, { MUSIC_STYLES }] = await Promise.all([import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/SetScore'), import('@wildshard/engine/audio/Cues'), import('@wildshard/engine/ui/Settings')]);
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
  const files = (await createNdAudio()).files();
  return [...files.music, ...files.sfx];
}
export interface NdScene { well: number }
export function ndPick(scene: NdScene, state: MusicState | undefined): readonly string[] {
  return [state?.mode === 'combat' ? 'nd-fight' : scene.well > 0.5 ? 'nd-well' : 'nd-market', 'nd-market'];
}
export async function ndScore(onReady: () => void): Promise<SetScore<NdScene> & ScoreSource> {
  const [{ SetScore }, { cachedBytes, decodeBytes }] = await Promise.all([import('@wildshard/engine/audio/SetScore'), import('@wildshard/engine/audio/preload')]);
  return new SetScore<NdScene>({ ...SCORE_SET, scene: { well: 0 }, pick: ndPick, read: cachedBytes, decode: decodeBytes, onReady, waitForBank: true });
}
