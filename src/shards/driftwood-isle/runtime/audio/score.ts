import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import source from '../../shard.config';
import { requireAudioProfile, type AudioMusicProfile } from '@wildshard/engine/audio/audioProfiles';

const PROFILE = requireAudioProfile(source.audio.music, 'score.driftwood');

/** The base genre bank's island slot in play; Music owns its common title slot on the menu. */
export class DriftwoodScore extends CatalogueScore {
  constructor(music:Music,scope:Scope,profile:AudioMusicProfile=PROFILE){super(music,profile,scope);}
}

/** Attach the admitted score profile to the existing island bank, decoder and bar-grid owner. */
export function installDriftwoodScore(audio: Audio, music: Music, scope: Scope, profile: AudioMusicProfile = PROFILE): DriftwoodScore {
  const score = new DriftwoodScore(music, scope, profile), bank = music.residentBank();
  if (bank) score.useStyleBank(bank);
  scope.onDispose(music.setScore(profile.id, score));
  audio.onLevelBank((level) => { if (level.title) score.useStyleBank(level.title); }, scope);
  scope.onDispose(() => { score.dispose(); });
  return score;
}
