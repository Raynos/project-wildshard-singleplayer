import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

const profile = requireAudioProfile(source.audio.samples, 'pine.samples');
/** Pine's original base-set decode selection and levels, supplied by its shardfile. */
export const FOREST_AUDIO = { bed: profile.bed, samples: { loopGains: profile.loopGains } };

/** Original fallback wind/gust preset; playback remains on the native mixer. */
export const FOREST_WIND_BED = requireAudioProfile(source.audio.ambience ?? undefined, 'ambience.pine.wind');
