import { createCatalogueAudio, type LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import { pineShotFiles, decodePineShots } from './sfx';
import source from '../../shard.config';

/** Declared boot routing; the existing sprite decoder retains its native cache. */
export const createPineAudio = (): Promise<LevelAudioProfile> => createCatalogueAudio(source.audio, { files: pineShotFiles, decode: decodePineShots });
/** Full selected-style-first inventory, independent of boot decode selection. */
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createPineAudio()).files(); return [...files.music, ...files.sfx];
}
