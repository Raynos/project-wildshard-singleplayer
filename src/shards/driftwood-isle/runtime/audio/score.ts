import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import source from '../../shard.config';
import { requireAudioProfile, type AudioMusicProfile } from '@wildshard/engine/audio/audioProfiles';

const PROFILE = requireAudioProfile(source.audio.music, 'score.driftwood');

/** Attach the island's declared bank and scope policies to the shared score owner. */
export function installDriftwoodScore(audio:Audio,music:Music,scope:Scope,profile:AudioMusicProfile=PROFILE):CatalogueScore {return CatalogueScore.install(audio,music,scope,profile);}
