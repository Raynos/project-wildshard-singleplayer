import type { LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import { FOREST_AUDIO } from './profile';
import { pineShotFiles, decodePineShots } from './sfx';

import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

const OWN = requireAudioProfile(source.audio.samples, 'pine.samples').set;
const BOOT_SLOTS = requireAudioProfile(source.audio.music, 'score.pine').bootSlots;
/** Full manifest inventory; selected decoding stays in the profile's bootFiles. */
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createPineAudio()).files();
  return [...files.music, ...files.sfx];
}
/** The existing selected-style-first file order and exclusions, owned by this level. */
export async function createPineAudio(): Promise<LevelAudioProfile> {
  const [{ audioFiles, musicDir, sfxDir }, { musicManifests, sfxManifests }, { getMusicStyle, getSfxSet }, { styleFiles, decodeStyle }, { sfxFiles, decodeSfxSet }] = await Promise.all([import('@wildshard/engine/boot/audioFiles'), import('@wildshard/engine/boot/tables'), import('@wildshard/engine/ui/Settings'), import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/preload')]);
  const ownMusic = (): string[] => {
    const style = getMusicStyle(), key = `${OWN}-${style}`;
    return style !== 'synth' && Object.hasOwn(musicManifests(), key) ? [key] : [];
  };
  const ownSfx = (): string[] => Object.hasOwn(sfxManifests(), OWN) ? [OWN] : [];
  return {
    files: () => audioFiles({ omitSlots: ['island'], musicSets: ownMusic(), sfxSets: ownSfx() }),
    priorityFiles: () => {
      const files = audioFiles({ musicSets: ownMusic(), sfxSets: ownSfx() });
      const dirs = [...ownMusic().map(musicDir), ...ownSfx().map(sfxDir)];
      return [...files.music, ...files.sfx].filter((url) => dirs.some((dir) => url.startsWith(dir)));
    },
    bootFiles: (style) => [...styleFiles(style, BOOT_SLOTS), ...sfxFiles(getSfxSet(), FOREST_AUDIO.bed, FOREST_AUDIO.samples), ...(getSfxSet() === 'synth' ? [] : pineShotFiles())],
    decode: async (style, read, decode, onFile) => {
      const [title, samples] = await Promise.all([
        decodeStyle(style, BOOT_SLOTS, read, decode, onFile).catch(() => undefined),
        decodeSfxSet(getSfxSet(), FOREST_AUDIO.bed, read, onFile, decode, FOREST_AUDIO.samples),
        ...(getSfxSet() === 'synth' ? [] : [decodePineShots(read, onFile)]),
      ]);
      return { title, samples, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } };
    },
  };
}
