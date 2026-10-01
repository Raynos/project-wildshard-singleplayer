import { loadAudio, type Audio, type Music, type MusicState, type ScoreSource, type Scope, type SlotAudio, type StyleBank, type StemSting, type MusicStyle } from '#engine';

/** The base style bank's island slot in play; Music owns its common title slot on the menu. */
export class DriftwoodScore implements ScoreSource {
  readonly base = 'island';
  readonly synthLead = 'marimba';
  readonly slots = ['island'];
  readonly minFade = 0;
  readonly stings = new Map<StemSting, AudioBuffer>();
  readonly failures = new Set<string>();
  readonly sceneName = 'day';
  private bank: StyleBank | undefined;
  private decoding: MusicStyle | undefined;
  constructor(private readonly music: Pick<Music, 'style' | 'refreshScore'>, private readonly scope: Scope) {}
  get pending(): boolean { return this.decoding !== undefined; }
  target(_state: MusicState): string { return this.base; }
  useBank(bank: Parameters<ScoreSource['useBank']>[0]): void {
    for (const [id, value] of bank.stings) this.stings.set(id, value);
  }
  useStyleBank(bank: StyleBank): void { this.bank = bank; this.stings.clear(); this.useBank(bank); }
  want(_playing: string | undefined): SlotAudio | undefined {
    const style = this.music.style;
    if (style === 'synth' || this.scope.disposed) return undefined;
    if (this.bank?.style === style) return this.bank.slots.get(this.base);
    if (this.decoding === style || this.failures.has(style)) return undefined;
    this.decoding = style;
    void this.prepare(style);
    return undefined;
  }
  private async prepare(style: MusicStyle): Promise<void> {
    try {
      const ports = await loadAudio();
      const bank = await ports.decodeStyle(style, ['title', this.base], ports.cachedBytes, ports.decodeBytes);
      if (!this.scope.disposed && this.music.style === style) this.useStyleBank(bank);
    } catch { this.failures.add(style); }
    finally {
      if (this.decoding === style) this.decoding = undefined;
      if (!this.scope.disposed) this.music.refreshScore();
    }
  }
  dispose(): void { this.bank = undefined; this.stings.clear(); this.failures.clear(); }
}

export function installDriftwoodScore(audio: Audio, music: Music, scope: Scope): DriftwoodScore {
  const score = new DriftwoodScore(music, scope), bank = music.residentBank();
  if (bank) score.useStyleBank(bank);
  scope.onDispose(music.setScore('score.driftwood', score));
  audio.onLevelBank((level) => { if (level.title) score.useStyleBank(level.title); }, scope);
  scope.onDispose(() => { score.dispose(); });
  return score;
}
