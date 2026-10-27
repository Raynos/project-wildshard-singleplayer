import { parseAudioData } from '@wildshard/sdk/audio';
import source from '../data/audioSource.json' with { type: 'json' };
import patches from '../data/voicePatches.json' with { type: 'json' };
import scene from '../data/audioScene.json' with { type: 'json' };

/** Owned audio declarations cross the same strict schema without a scheduler file.
 * Each call owns the parsed cue, voice and scene rows; no decoder, score or audio service is installed. */
export function nalatiAudioRows(): { audio: ReturnType<typeof parseAudioData> } {
  return { audio: parseAudioData({ patches, scene, ...source }) };
}
