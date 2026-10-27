import { parseClientChannels, parseItems } from '@wildshard/sdk/rows';
import { parseAudioData } from '@wildshard/sdk/audio';
import source from '../data/audioSource.json' with { type: 'json' };
import { pineSkyChannels } from './skyChannels';
import { pineRainChannels } from './rainChannels';
import { PINE_WEATHER_PROGRAMS } from './weatherChannels';
import { PINE_ITEMS } from './items';

// GR8: the product calls these directly (the pine-hollow-items, -audio, -sky-channels and -weather-channels jobs and their
// generated JSON are gone); every section is canonical-encoded on write, so the bytes are the jobs' own.

/** The admitted item catalogue (`items`). */
export function pineItems(): ReturnType<typeof parseItems> { return parseItems(PINE_ITEMS); }
/** The validated audio section (`audio/audio`). */
export function pineAudio(): { audio: ReturnType<typeof parseAudioData> } { return { audio: parseAudioData(source.audio) }; }
/** The sky's and rain's client channel programs. */
export function pineSkyChannelSection(): { clientChannels: ReturnType<typeof parseClientChannels> } {
  return { clientChannels: parseClientChannels([...pineSkyChannels(), ...pineRainChannels()]) };
}
/** The weather's client channel programs. */
export function pineWeatherChannelSection(): { clientChannels: ReturnType<typeof parseClientChannels> } {
  return { clientChannels: parseClientChannels(PINE_WEATHER_PROGRAMS) };
}
