import { createCatalogueAudio, type LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
import { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Declared boot routing; the existing sprite decoder retains its native cache. */
export async function createPineAudio(product?: ShardProduct): Promise<LevelAudioProfile> {
  if (product !== undefined) return createCatalogueAudio(product.section('audio/audio').audio);
  // Background boot inventory runs as shell code. The returned catalogue borrows
  // plain audio rows, so its temporary product lease ends after preparation.
  const scope = new Scope('pine.audio.catalogue');
  try {
    const built = await (await import('@wildshard/game/shardfile/runtimeProduct')).loadFirstPartyProduct('pine-hollow', scope);
    return await createPineAudio(built);
  } finally { scope.dispose(); }
}
/** Full selected-style-first inventory, independent of boot decode selection. */
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createPineAudio()).files(); return [...files.music, ...files.sfx];
}
