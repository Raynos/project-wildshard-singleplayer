import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music, MusicState } from '@wildshard/engine/audio/Music';
import type { ScoreSource } from '@wildshard/engine/audio/SetScore';
import type { SlotAudio, StyleBank, StemSting, BossPhase } from '@wildshard/engine/audio/Stems';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import type { MusicStyle } from '@wildshard/engine/ui/Settings';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import { selectScoreSlots } from '@wildshard/engine/audio/scoreSelection';
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
export class PineScore implements ScoreSource {
  readonly base = PROFILE.base;
  readonly synthLead = PROFILE.synthLead;
  readonly slots = PROFILE.slots;
  readonly minFade = PROFILE.minFade;
  readonly stings = new Map<StemSting, AudioBuffer>();
  readonly failures = new Set<string>();
  sceneName: PineScene = 'day';
  phase: BossPhase = 1;
  private theme: SlotAudio | undefined;
  private extra: { genre: MusicStyle; slot: SlotAudio | undefined; dawn: AudioBuffer | undefined } | undefined;
  private decoding = new Set<string>();
  private dawnWanted = false;
  private scope: Scope | undefined;
  private genre: MusicStyle | undefined;
  constructor(private readonly music: Pick<Music, 'genre' | 'state' | 'refreshScore' | 'combat' | 'sting'>) {
    const pin = pineScorePick(), match = pin === 'auto' ? null : /^(night|boss|dawn)(?:-([123]))?$/.exec(pin);
    if (match) {
      if (match[1] === 'night' || match[1] === 'boss') this.sceneName = match[1];
      this.dawnWanted = match[1] === 'dawn';
      if (match[2] === '2' || match[2] === '3') this.phase = match[2] === '2' ? 2 : 3;
    }
  }
  get pending(): boolean { return this.decoding.size > 0; }
  target(_state: MusicState): string { return selectScoreSlots(PROFILE.selection, PROFILE.selectMode, { scene: this.sceneName })[0] ?? this.base; }
  useBank(bank: Parameters<ScoreSource['useBank']>[0]): void {
    const theme = bank.slots.get(this.base); if (theme) { this.theme = theme; this.stings.clear(); }
    for (const [name, buffer] of bank.stings) this.stings.set(name, buffer);
  }
  useStyleBank(bank: StyleBank): void { this.useBank(bank); }
  want(_playing: string | undefined): SlotAudio | undefined {
    const genre = this.music.genre, want = this.target(this.music.state);
    if (genre !== this.genre) { this.genre = genre; this.failures.clear(); }
    if (genre === 'synth') return undefined;
    if (want !== this.base) {
      const slot = this.extra?.genre === genre ? this.extra.slot : undefined;
      if (slot?.slot === want) return slot;
      this.prepare(genre, want);
    }
    if (this.theme?.genre === genre) return this.theme;
    this.prepare(genre, this.base);
    return undefined;
  }
  private prepare(genre: MusicStyle, slot: string): void {
    const key = `${genre}/${slot}`;
    if (this.decoding.has(key) || this.failures.has(key) || this.scope?.disposed) return;
    const owner = this.scope;
    this.decoding.add(key);
    void (async () => {
      let bank: StyleBank | undefined;
      try {
        const [{ decodeStyle }, { cachedBytes, decodeBytes }] = await Promise.all([import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/preload')]);
        bank = await decodeStyle(genre, [slot], cachedBytes, decodeBytes, undefined, PROFILE.sets[slot] ?? 'base', slot === this.base ? undefined : ['dawn']);
      } catch (error) { console.info(`[music] pine-hollow ${key}: ${error instanceof Error ? error.message : String(error)} — the theme plays`); }
      finally { this.decoding.delete(key); }
      if (owner?.disposed || this.scope !== owner) return;
      const audio = bank?.slots.get(slot);
      if (!audio) { this.failures.add(key); return; }
      if (this.music.genre !== genre || this.scope?.disposed) return;
      if (slot === this.base && bank) this.useStyleBank(bank);
      else this.extra = { genre, slot: audio, dawn: bank?.stings.get('dawn') ?? (this.extra?.genre === genre ? this.extra.dawn : undefined) };
      this.music.refreshScore();
    })();
  }
  async sting(name: StemSting): Promise<AudioBuffer | undefined> {
    if (name !== 'dawn') return this.stings.get(name);
    const genre = this.music.genre;
    const owner = this.scope;
    if (this.extra?.genre === genre && this.extra.dawn) return this.extra.dawn;
    try {
      const [{ decodeStyle }, { cachedBytes, decodeBytes }] = await Promise.all([import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/preload')]);
      const bank = await decodeStyle(genre, [], cachedBytes, decodeBytes, undefined, 'pine-hollow', ['dawn']);
      if (owner?.disposed || this.scope !== owner) return undefined;
      const buffer = bank.stings.get('dawn');
      if (buffer && this.music.genre === genre && !this.scope?.disposed) this.extra = { genre, slot: this.extra?.genre === genre ? this.extra.slot : undefined, dawn: buffer };
      return buffer;
    } catch { return undefined; }
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
  attach(scope: Scope): void { this.scope = scope; scope.onDispose(() => { this.theme = undefined; this.extra = undefined; this.stings.clear(); }); }
}
export function pineScore(music: Music): PineScore {
  const have = sources.get(music); if (have) return have;
  const score = new PineScore(music);
  const bank = music.residentBank(); if (bank) score.useStyleBank(bank);
  music.setScore(PROFILE.id, score); sources.set(music, score); return score;
}
export function installPineScore(audio: Audio, music: Music, scope: Scope, debugRow?: ShardContext['debugRow']): PineScore {
  const score = pineScore(music); score.attach(scope);
  debugRow?.({ id: 'pineScore', group: 'audio', label: 'Pine Hollow score', choices: PINE_SCORE_PICKS.map((value) => ({ value, text: value === 'auto' ? 'Auto' : value === 'boss' ? 'Boss I' : value === 'boss-2' ? 'Boss II' : value === 'boss-3' ? 'Boss III' : value === 'dawn' ? 'Dawn sting' : 'Night' })), initial: pineScorePick(), reload: true, change: () => undefined, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: pin the scene, boss layers or reward sting.' });
  scope.onDispose(music.setScore(PROFILE.id, score));
  audio.onLevelBank((bank) => { if (bank.title) score.useStyleBank(bank.title); }, scope);
  return score;
}

/** Suspend a retained home's score on the road without restarting its authored scene or boss phase on re-entry. */
export function installEnteredPineScore(context: ShardContext, audio: Audio, music: Music, debugRow?: ShardContext['debugRow']): void {
  if (!retainsRuntimeServices(context)) {
    installPineScore(audio, music, context.scope, debugRow);
    return;
  }
  let registerDebug = true;
  installEnteredRuntimeService(context, (scope) => {
    const score = installPineScore(audio, music, scope, registerDebug ? debugRow : undefined);
    registerDebug = false;
    const bank = music.residentBank();
    if (bank !== undefined) score.useStyleBank(bank);
  });
}
