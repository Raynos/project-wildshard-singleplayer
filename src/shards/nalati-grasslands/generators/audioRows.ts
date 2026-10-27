import { parseAudioData } from '@wildshard/sdk/audio';
import source from '../data/audioSource.json' with { type: 'json' };
import patches from '../data/voicePatches.json' with { type: 'json' };
import scene from '../data/audioScene.json' with { type: 'json' };

/** The retired writer used canonical JSON; preserve its object-key order in owned rows too. */
function publicationOrder<T>(input: T): T {
  const copy = structuredClone(input);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { for (const child of value) visit(child); return; }
    if (typeof value !== 'object' || value === null) return;
    const entries = Object.keys(value).sort().map(key => [key, Reflect.get(value, key)] as const);
    for (const [key, child] of entries) { visit(child); Reflect.deleteProperty(value, key); }
    for (const [key, child] of entries) Reflect.set(value, key, child);
  };
  visit(copy);
  return copy;
}

/** Owned audio declarations cross the same strict schema without a scheduler file.
 * Each call owns the parsed cue, voice and scene rows; no decoder, score or audio service is installed. */
export function nalatiAudioRows(): { audio: Omit<ReturnType<typeof parseAudioData>, 'scene'> & { scene: typeof scene } } {
  const input = { patches, scene, ...source }, audio = parseAudioData(input);
  return publicationOrder({ audio: { ...audio, scene: structuredClone(input.scene) } });
}
