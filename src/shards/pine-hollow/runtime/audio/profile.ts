import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Original base-set gains and fallback wind from this entry's admitted audio section. */
export function pineAudioProfile(product: ShardProduct): { bed: string; samples: { loopGains: Readonly<Record<string, number>> }; wind: Parameters<Audio['windBed']>[0] } {
  const rows = product.section('audio/audio').audio;
  const profile = requireAudioProfile(rows.samples, 'pine.samples');
  return { bed: profile.bed, samples: { loopGains: profile.loopGains },
    wind: requireAudioProfile(rows.ambience ?? undefined, 'ambience.pine.wind') };
}
