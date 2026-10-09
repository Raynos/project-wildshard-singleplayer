import type { Audio } from '@wildshard/engine/audio/Audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { FOREST_AUDIO } from './profile';
import { installForestVoices, type ForestVoices } from './synth';

/** Keep Pine's original kit registration outside retained mode; retained voices exist only during a home entry. */
export function installEnteredPineVoices(context: ShardContext, audio: Audio): () => ForestVoices | null {
  if (!retainsRuntimeServices(context)) {
    const voices = installForestVoices(audio, context.scope);
    return () => voices;
  }
  let voices: ForestVoices | null = null;
  installEnteredRuntimeService(context, (scope) => {
    const previousBed = audio.bedId;
    const entered = installForestVoices(audio, scope);
    voices = entered;
    audio.setAmbient(FOREST_AUDIO.bed);
    scope.onDispose(() => {
      if (audio.bedId === FOREST_AUDIO.bed) audio.setAmbient(previousBed);
      if (voices === entered) voices = null;
    });
  });
  return () => voices;
}
