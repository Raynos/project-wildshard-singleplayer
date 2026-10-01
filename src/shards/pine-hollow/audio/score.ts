import type { ShardContext } from '#game';
import { loadAudio, jsonSlot, type Audio, type Music, type MusicState, type ScoreSource, type Scope, type SlotAudio, type StyleBank, type StemSting, type BossPhase, type MusicStyle } from '#engine';

export type PineScene = 'day' | 'night' | 'boss';
export const PINE_SCORE_PICKS = ['auto', 'night', 'boss', 'boss-2', 'boss-3', 'dawn'] as const;
export function pineScorePick(): (typeof PINE_SCORE_PICKS)[number] {
  const saved = jsonSlot('debug.plugin.pine-hollow.pineScore', 'device').read();
  const legacy = jsonSlot('settings', 'global').read();
  const value = saved ?? (legacy !== null && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy['pineScore'] : undefined);
  return PINE_SCORE_PICKS.find((choice) => choice === value) ?? 'auto';
}
const sources = new WeakMap<Music, PineScore>();

/** Scene, style, phase and reward policy for the existing Pine recordings. */
export class PineScore implements ScoreSource {
  readonly base = 'pine';
  readonly slots = ['pine', 'night', 'boss'];
  readonly minFade = 0;
  readonly stings = new Map<StemSting, AudioBuffer>();
  readonly failures = new Set<string>();
  sceneName: PineScene = 'day';
  phase: BossPhase = 1;
  private theme: SlotAudio | undefined;
  private extra: { style: MusicStyle; slot: SlotAudio | undefined; dawn: AudioBuffer | undefined } | undefined;
  private decoding = new Set<string>();
  private dawnWanted = false;
  private scope: Scope | undefined;
  private style: MusicStyle | undefined;
  constructor(private readonly music: Pick<Music, 'style' | 'state' | 'refreshScore' | 'combat' | 'sting'>) {
    const pin = pineScorePick(), match = pin === 'auto' ? null : /^(night|boss|dawn)(?:-([123]))?$/.exec(pin);
    if (match) {
      if (match[1] === 'night' || match[1] === 'boss') this.sceneName = match[1];
      this.dawnWanted = match[1] === 'dawn';
      if (match[2] === '2' || match[2] === '3') this.phase = match[2] === '2' ? 2 : 3;
    }
  }
  get pending(): boolean { return this.decoding.size > 0; }
  target(_state: MusicState): string { return this.sceneName === 'day' ? 'pine' : this.sceneName; }
  useBank(bank: Parameters<ScoreSource['useBank']>[0]): void {
    const theme = bank.slots.get('pine'); if (theme) { this.theme = theme; this.stings.clear(); }
    for (const [name, buffer] of bank.stings) this.stings.set(name, buffer);
  }
  useStyleBank(bank: StyleBank): void { this.useBank(bank); }
  want(_playing: string | undefined): SlotAudio | undefined {
    const style = this.music.style, want = this.target(this.music.state);
    if (style !== this.style) { this.style = style; this.failures.clear(); }
    if (style === 'synth') return undefined;
    if (want !== 'pine') {
      const slot = this.extra?.style === style ? this.extra.slot : undefined;
      if (slot?.slot === want) return slot;
      this.prepare(style, want === 'boss' ? 'boss' : 'night');
    }
    if (this.theme?.style === style) return this.theme;
    this.prepare(style, 'pine');
    return undefined;
  }
  private prepare(style: MusicStyle, slot: 'pine' | 'night' | 'boss'): void {
    const key = `${style}/${slot}`;
    if (this.decoding.has(key) || this.failures.has(key) || this.scope?.disposed) return;
    this.decoding.add(key);
    void (async () => {
      let bank: StyleBank | undefined;
      try {
        const ports = await loadAudio();
        bank = await ports.decodeStyle(style, [slot], ports.cachedBytes, ports.decodeBytes, undefined, slot === 'pine' ? 'base' : 'pine-hollow', slot === 'pine' ? undefined : ['dawn']);
      } catch (error) { console.info(`[music] pine-hollow ${key}: ${error instanceof Error ? error.message : String(error)} — the theme plays`); }
      finally { this.decoding.delete(key); }
      const audio = bank?.slots.get(slot);
      if (!audio) { this.failures.add(key); return; }
      if (this.music.style !== style || this.scope?.disposed) return;
      if (slot === 'pine' && bank) this.useStyleBank(bank);
      else this.extra = { style, slot: audio, dawn: bank?.stings.get('dawn') ?? (this.extra?.style === style ? this.extra.dawn : undefined) };
      this.music.refreshScore();
    })();
  }
  async sting(name: StemSting): Promise<AudioBuffer | undefined> {
    if (name !== 'dawn') return this.stings.get(name);
    const style = this.music.style;
    if (this.extra?.style === style && this.extra.dawn) return this.extra.dawn;
    try {
      const ports = await loadAudio(), bank = await ports.decodeStyle(style, [], ports.cachedBytes, ports.decodeBytes, undefined, 'pine-hollow', ['dawn']);
      const buffer = bank.stings.get('dawn');
      if (buffer && this.music.style === style && !this.scope?.disposed) this.extra = { style, slot: this.extra?.style === style ? this.extra.slot : undefined, dawn: buffer };
      return buffer;
    } catch { return undefined; }
  }
  private log(id: string): void { void loadAudio().then((ports) => ports.audioLog('music', id)); }
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
  music.setScore('score.pine', score); sources.set(music, score); return score;
}
export function installPineScore(audio: Audio, music: Music, scope: Scope, debugRow?: ShardContext['debugRow']): PineScore {
  const score = pineScore(music); score.attach(scope);
  debugRow?.({ id: 'pineScore', group: 'audio', label: 'Pine Hollow score', choices: PINE_SCORE_PICKS.map((value) => ({ value, text: value === 'auto' ? 'Auto' : value === 'boss' ? 'Boss I' : value === 'boss-2' ? 'Boss II' : value === 'boss-3' ? 'Boss III' : value === 'dawn' ? 'Dawn sting' : 'Night' })), initial: pineScorePick(), reload: true, change: () => undefined, ask: 'E357', reviewBy: '2026-12-30', note: 'E357: pin the scene, boss layers or reward sting.' });
  scope.onDispose(music.setScore('score.pine', score));
  audio.onLevelBank((bank) => { if (bank.title) score.useStyleBank(bank.title); }, scope);
  return score;
}
