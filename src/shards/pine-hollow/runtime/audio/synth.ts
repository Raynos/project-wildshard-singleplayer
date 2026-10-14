import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { WindGustBed } from '@wildshard/engine/audio/util';
import { FOREST_AUDIO, FOREST_WIND_BED } from './profile';

export function installForestVoices(audio: Audio, scope: Scope, preset:ConstructorParameters<typeof WindGustBed>[1]=FOREST_WIND_BED): WindGustBed {
  const voices = new WindGustBed(audio,preset);
  audio.installSynthBed(FOREST_AUDIO.bed, voices, scope);
  return voices;
}
