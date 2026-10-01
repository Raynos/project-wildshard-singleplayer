import { loadAudio, type LevelAudioProfile } from '#engine';
import { pineShotFiles, decodePineShots } from './sfx';

const OWN = 'pine-hollow';
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** The existing selected-style-first file order and exclusions, owned by this level. */
export async function createPineAudio(): Promise<LevelAudioProfile> {
  const { audioFiles, MUSIC_MANIFESTS, SFX_MANIFESTS, sfxSets, getMusicStyle, getSfxSet, manifestFiles, musicDir, sfxDir, DRIFTWOOD_SOUNDS, styleFiles, sfxFiles, decodeStyle, decodeSfxSet } = await loadAudio();
  const ownMusic = (): string[] => {
    const style = getMusicStyle(), key = `${OWN}-${style}`;
    return style !== 'synth' && Object.hasOwn(MUSIC_MANIFESTS, key) ? [key] : [];
  };
  const ownSfx = (): string[] => Object.hasOwn(SFX_MANIFESTS, OWN) ? [OWN] : [];
  const skip = (): Record<string, string[]> => Object.fromEntries(sfxSets().map((set) => {
    const table = SFX_MANIFESTS[set], files: string[] = [];
    if (object(table)) for (const section of ['beds', 'hums', 'oneshots'] as const) {
      const entries = table[section];
      if (object(entries)) for (const [id, entry] of Object.entries(entries)) if (DRIFTWOOD_SOUNDS[section].includes(id)) files.push(...manifestFiles(entry));
    }
    return [set, files];
  }));
  return {
    files: () => audioFiles({ omitSlots: ['island'], musicSets: ownMusic(), sfxSets: ownSfx(), omitSfx: skip() }),
    priorityFiles: () => {
      const files = audioFiles({ musicSets: ownMusic(), sfxSets: ownSfx() });
      const dirs = [...ownMusic().map(musicDir), ...ownSfx().map(sfxDir)];
      return [...files.music, ...files.sfx].filter((url) => dirs.some((dir) => url.startsWith(dir)));
    },
    bootFiles: (style) => [...styleFiles(style, ['title', 'pine']), ...sfxFiles(getSfxSet(), 'forest'), ...(getSfxSet() === 'synth' ? [] : pineShotFiles())],
    decode: async (style, read, decode, onFile) => {
      const [title, samples] = await Promise.all([
        decodeStyle(style, ['title', 'pine'], read, decode, onFile).catch(() => undefined),
        decodeSfxSet(getSfxSet(), 'forest', read, onFile, decode),
        ...(getSfxSet() === 'synth' ? [] : [decodePineShots(read, onFile)]),
      ]);
      return { title, samples, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
    },
  };
}
