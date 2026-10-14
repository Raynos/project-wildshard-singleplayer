import type { Audio } from '@wildshard/engine/audio/Audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { FOREST_AUDIO, FOREST_WIND_BED } from './profile';

type ForestVoices = ReturnType<Audio['windBed']>;

/** Keep Pine's original kit registration outside retained mode; retained voices exist only during a home entry. */
export function installEnteredPineVoices(context: ShardContext, audio: Audio): () => ForestVoices | null {
  const preset = context.game.declaredAudio === undefined ? FOREST_WIND_BED : context.game.declaredAudio.ambience;
  if (preset === null) throw new Error('Missing declared forest wind');
  if (!retainsRuntimeServices(context)) {
    const voices = audio.windBed(preset, context.scope);
    return () => voices;
  }
  let voices: ForestVoices | null = null;
  installEnteredRuntimeService(context, (scope) => {
    const previousBed = audio.bedId;
    const entered = audio.windBed(preset, scope);
    voices = entered;
    audio.setAmbient(FOREST_AUDIO.bed);
    scope.onDispose(() => {
      if (audio.bedId === FOREST_AUDIO.bed) audio.setAmbient(previousBed);
      if (voices === entered) voices = null;
    });
  });
  return () => voices;
}
