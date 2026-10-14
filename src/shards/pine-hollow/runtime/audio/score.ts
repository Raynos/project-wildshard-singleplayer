import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { requireAudioProfile, type AudioMusicProfile } from '@wildshard/engine/audio/audioProfiles';
import { runtimeAudio } from '@wildshard/game/plugin/audio';
import source from '../../shard.config';

const PROFILE = requireAudioProfile(source.audio.music, 'score.pine');

export type PineScene = 'day' | 'night' | 'boss';
export const PINE_SCORE_PICKS = ['auto', 'night', 'boss', 'boss-2', 'boss-3', 'dawn'] as const;
export function pineScorePick(): (typeof PINE_SCORE_PICKS)[number] {
  const saved = jsonSlot('debug.plugin.pine-hollow.pineScore', 'device').read();
  const legacy = jsonSlot('settings', 'global').read();
  const value = saved ?? (legacy !== null && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy['pineScore'] : undefined);
  return PINE_SCORE_PICKS.find((choice) => choice === value) ?? 'auto';
}
/** Pine uses the platform resident score and its declared scene/phase/sting policy. */
export type PineScore = CatalogueScore;
export function pineScore(music:Music,profile?:AudioMusicProfile):CatalogueScore {return CatalogueScore.get(music,profile??PROFILE,pineScorePick,undefined,profile!==undefined);}
export function installPineScore(audio: Audio, music: Music, scope: Scope, debugRow?: ShardContext['debugRow'], profile: AudioMusicProfile = PROFILE): PineScore {
  return CatalogueScore.install(audio,music,scope,profile,{pin:pineScorePick,beforeBind:()=>{debugRow?.({ id: 'pineScore', group: 'audio', label: 'Pine Hollow score', choices: PINE_SCORE_PICKS.map((value) => ({ value, text: value === 'auto' ? 'Auto' : value === 'boss' ? 'Boss I' : value === 'boss-2' ? 'Boss II' : value === 'boss-3' ? 'Boss III' : value === 'dawn' ? 'Dawn sting' : 'Night' })), initial: pineScorePick(), reload: true, change: () => undefined, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: pin the scene, boss layers or reward sting.' });
  }});
}

/** Suspend a retained home's score on the road without restarting its authored scene or boss phase on re-entry. */
export function installEnteredPineScore(context: ShardContext, audio: Audio, music: Music, debugRow?: ShardContext['debugRow']): void {
  const profile = requireAudioProfile(runtimeAudio(context, source.audio).music, 'score.pine');
  const retained=retainsRuntimeServices(context);
  let registerDebug = true;
  installEnteredRuntimeService(context, (scope) => {
    const score = installPineScore(audio, music, scope, registerDebug ? debugRow : undefined, profile);
    registerDebug = false;
    if(retained){const bank=music.residentBank();if(bank!==undefined)score.useStyleBank(bank);}
  });
}
