import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import type { BossPhase } from '@wildshard/engine/audio/Stems';
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
const sources = new WeakMap<Music, PineScore>();

/** Scene, genre, phase and reward policy for the existing Pine recordings. */
export class PineScore extends CatalogueScore {
  private dawnWanted = false;
  constructor(music:ConstructorParameters<typeof CatalogueScore>[0],profile:AudioMusicProfile=PROFILE) {
    super(music,profile);
    const pin=pineScorePick(),match=pin==='auto'?null:/^(night|boss|dawn)(?:-([123]))?$/.exec(pin);
    if(match){if(match[1]==='night'||match[1]==='boss')this.sceneName=match[1];this.dawnWanted=match[1]==='dawn';if(match[2]==='2'||match[2]==='3')this.phase=match[2]==='2'?2:3;}
  }
  private log(id: string): void { void import('@wildshard/engine/audio/audioLog').then(({ audioLog }) => audioLog('music', id)); }
  setPineScene(scene: PineScene): void {
    if (scene === this.sceneName) return;
    this.sceneName = scene; this.log(`scene:${scene}`);
    if (scene === 'boss') this.phase = 1;
    this.music.refreshScore();
  }
  setBossPhase(phase: BossPhase): void {
    if (phase === this.phase) return;
    this.phase = phase; this.log(`phase:${phase}`); this.music.refreshScore();
  }
  combat(intensity: number): void { this.music.combat(intensity); }
  playSting(name: 'chunk' | 'death' | 'pickup'): void { this.music.sting(name); }
  onDeck(slot: string): void {
    if (!this.dawnWanted || slot === 'title') return;
    this.dawnWanted = false;
    this.scope?.timeout(2000, () => { this.music.sting('dawn'); });
  }
}
export function pineScore(music: Music, profile?: AudioMusicProfile): PineScore {
  const have = sources.get(music); if (have) { if (profile !== undefined) have.bindProfile(profile); return have; }
  const score = new PineScore(music, profile);
  const bank = music.residentBank(); if (bank) score.useStyleBank(bank);
  music.setScore(profile?.id ?? PROFILE.id, score); sources.set(music, score); return score;
}
export function installPineScore(audio: Audio, music: Music, scope: Scope, debugRow?: ShardContext['debugRow'], profile: AudioMusicProfile = PROFILE): PineScore {
  const score = pineScore(music, profile); score.attach(scope);
  debugRow?.({ id: 'pineScore', group: 'audio', label: 'Pine Hollow score', choices: PINE_SCORE_PICKS.map((value) => ({ value, text: value === 'auto' ? 'Auto' : value === 'boss' ? 'Boss I' : value === 'boss-2' ? 'Boss II' : value === 'boss-3' ? 'Boss III' : value === 'dawn' ? 'Dawn sting' : 'Night' })), initial: pineScorePick(), reload: true, change: () => undefined, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: pin the scene, boss layers or reward sting.' });
  scope.onDispose(music.setScore(profile.id, score));
  audio.onLevelBank((bank) => { if (bank.title) score.useStyleBank(bank.title); }, scope);
  return score;
}

/** Suspend a retained home's score on the road without restarting its authored scene or boss phase on re-entry. */
export function installEnteredPineScore(context: ShardContext, audio: Audio, music: Music, debugRow?: ShardContext['debugRow']): void {
  const profile = requireAudioProfile(runtimeAudio(context, source.audio).music, 'score.pine');
  if (!retainsRuntimeServices(context)) {
    installPineScore(audio, music, context.scope, debugRow, profile);
    return;
  }
  let registerDebug = true;
  installEnteredRuntimeService(context, (scope) => {
    const score = installPineScore(audio, music, scope, registerDebug ? debugRow : undefined, profile);
    registerDebug = false;
    const bank = music.residentBank();
    if (bank !== undefined) score.useStyleBank(bank);
  });
}
