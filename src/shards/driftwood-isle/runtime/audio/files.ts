import { createCatalogueAudio, type LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import source from '../../shard.config';

/** Declared selected/base + island overlay, over the original decoder and banks. */
export const createDriftwoodAudio = (): Promise<LevelAudioProfile> => createCatalogueAudio(source.audio);
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createDriftwoodAudio()).files(); return [...files.music, ...files.sfx];
}
