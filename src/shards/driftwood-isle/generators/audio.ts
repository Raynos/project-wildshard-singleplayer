import { parseAudioData, type AudioData } from '@wildshard/sdk/audio';
import source from '../data/audioSource.json' with { type: 'json' };
import cove from '../data/coveComposition.json' with { type: 'json' };
import type { FixedWreckLayout } from './fixedLayouts';
import { driftwoodGameplayAudioEnvironment } from './gameplayAudioEnvironment';

/** Admit the original complete audio declaration over the native wreck facts. */
export function driftwoodAudio(wreck: FixedWreckLayout): AudioData {
  return parseAudioData({ ...source.audio, gameplay: { ...source.audio.gameplay,
    entryEnvironment: driftwoodGameplayAudioEnvironment(wreck),
    constants: { cove: { fall: cove.audioFall, cave: cove.audioCave, caveBounds: cove.audioBounds } } } });
}
