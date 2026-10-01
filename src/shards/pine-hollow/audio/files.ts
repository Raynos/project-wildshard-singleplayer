import { loadAudio, type LevelAudioProfile } from '#engine';
import { FOREST_AUDIO } from './profile';
import { pineShotFiles, decodePineShots } from './sfx';

const OWN = 'pine-hollow';
/** Manifest inventory: the same selected files the profile decodes at boot. */
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const [{ getMusicStyle }, profile] = await Promise.all([loadAudio(), createPineAudio()]);
  return profile.bootFiles(getMusicStyle());
}
/** The existing selected-style-first file order and exclusions, owned by this level. */
export async function createPineAudio(): Promise<LevelAudioProfile> {
  const { audioFiles, MUSIC_MANIFESTS, SFX_MANIFESTS, getMusicStyle, getSfxSet, musicDir, sfxDir, styleFiles, sfxFiles, decodeStyle, decodeSfxSet } = await loadAudio();
  const ownMusic = (): string[] => {
    const style = getMusicStyle(), key = `${OWN}-${style}`;
    return style !== 'synth' && Object.hasOwn(MUSIC_MANIFESTS, key) ? [key] : [];
  };
  const ownSfx = (): string[] => Object.hasOwn(SFX_MANIFESTS, OWN) ? [OWN] : [];
  return {
    files: () => audioFiles({ omitSlots: ['island'], musicSets: ownMusic(), sfxSets: ownSfx() }),
    priorityFiles: () => {
      const files = audioFiles({ musicSets: ownMusic(), sfxSets: ownSfx() });
      const dirs = [...ownMusic().map(musicDir), ...ownSfx().map(sfxDir)];
      return [...files.music, ...files.sfx].filter((url) => dirs.some((dir) => url.startsWith(dir)));
    },
    bootFiles: (style) => [...styleFiles(style, ['title', 'pine']), ...sfxFiles(getSfxSet(), FOREST_AUDIO.bed, FOREST_AUDIO.samples), ...(getSfxSet() === 'synth' ? [] : pineShotFiles())],
    decode: async (style, read, decode, onFile) => {
      const [title, samples] = await Promise.all([
        decodeStyle(style, ['title', 'pine'], read, decode, onFile).catch(() => undefined),
        decodeSfxSet(getSfxSet(), FOREST_AUDIO.bed, read, onFile, decode, FOREST_AUDIO.samples),
        ...(getSfxSet() === 'synth' ? [] : [decodePineShots(read, onFile)]),
      ]);
      return { title, samples, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
    },
  };
}
