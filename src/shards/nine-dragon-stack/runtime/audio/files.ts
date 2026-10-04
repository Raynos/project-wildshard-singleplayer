import type { LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import type { MusicState } from '@wildshard/engine/audio/Music';
import type { SetScore, ScoreSource } from '@wildshard/engine/audio/SetScore';

import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import { selectScoreSlots } from '@wildshard/engine/audio/scoreSelection';
import source from '../../shard.config';

const PROFILE = requireAudioProfile(source.audio.music, 'score.nd');
export const SCORE_SET = requireAudioProfile(PROFILE.source ?? undefined, 'nd.music.source');
export const SFX_SET = requireAudioProfile(source.audio.samples, 'nd.samples').set;
const BOOT_SLOTS = PROFILE.bootSlots.filter((slot) => slot !== 'title');
export async function createNdAudio(): Promise<LevelAudioProfile> {
  const [{ musicManifest, shipped, decodeStyle }, { scoreFiles, decodeScore }, { cueFiles, decodeCueSet }, { MUSIC_STYLES }] = await Promise.all([import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/SetScore'), import('@wildshard/engine/audio/Cues'), import('@wildshard/engine/ui/Settings')]);
  const titleFiles = (style: Parameters<LevelAudioProfile['bootFiles']>[0]): string[] => {
    const title = musicManifest(style)?.slots['title'];
    return title ? [`/assets/music/${style}/${title.calm}`].filter(shipped) : [];
  };
  return {
    files: () => ({ music: [...MUSIC_STYLES.flatMap(titleFiles), ...scoreFiles(SCORE_SET)], sfx: cueFiles(SFX_SET) }),
    bootFiles: (style) => [...titleFiles(style), ...scoreFiles(SCORE_SET, BOOT_SLOTS), ...cueFiles(SFX_SET)],
    decode: async (style, read, decode, onFile) => {
      const [title, score, cues] = await Promise.all([
        decodeStyle(style, ['title'], read, decode, onFile, 'base', []).catch(() => undefined),
        decodeScore(SCORE_SET, BOOT_SLOTS, read, decode, true, onFile),
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
  return selectScoreSlots(PROFILE.selection, PROFILE.selectMode, { mode: state?.mode ?? null, well: scene.well });
}
export async function ndScore(onReady: () => void): Promise<SetScore<NdScene> & ScoreSource> {
  const [{ SetScore }, { cachedBytes, decodeBytes }] = await Promise.all([import('@wildshard/engine/audio/SetScore'), import('@wildshard/engine/audio/preload')]);
  return new SetScore<NdScene>({ ...SCORE_SET, minFade: PROFILE.minFade, synthLead: PROFILE.synthLead, scene: { well: 0 }, pick: ndPick, read: cachedBytes, decode: decodeBytes, onReady, waitForBank: true });
}
