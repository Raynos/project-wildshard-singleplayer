import { createCatalogueAudio, type LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';

/** Declared selected/base + island overlay, over the original decoder and banks: the audio section of the product the
 *  loader admits before the first hook (W2b: never shard.config). */
export async function createDriftwoodAudio(): Promise<LevelAudioProfile> {
  const { firstPartyDescriptor } = await import('@wildshard/game/shardfile/runtimeProduct');
  return createCatalogueAudio((await firstPartyDescriptor('driftwood-isle')).audio);
}
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createDriftwoodAudio()).files(); return [...files.music, ...files.sfx];
}
