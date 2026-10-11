import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Music, MusicState } from '@wildshard/engine/audio/Music';
import type { ScoreSource } from '@wildshard/engine/audio/SetScore';
import type { SlotAudio, StyleBank, StemSting } from '@wildshard/engine/audio/Stems';
import type { MusicStyle } from '@wildshard/engine/ui/Settings';
import { selectScoreSlots } from '@wildshard/engine/audio/scoreSelection';
import source from '../../shard.config';
import { requireAudioProfile, type AudioMusicProfile } from '@wildshard/engine/audio/audioProfiles';

const PROFILE = requireAudioProfile(source.audio.music, 'score.driftwood');

/** The base genre bank's island slot in play; Music owns its common title slot on the menu. */
export class DriftwoodScore implements ScoreSource {
  readonly base: string;
  readonly synthLead: AudioMusicProfile['synthLead'];
  readonly slots: readonly string[];
  readonly minFade: number;
  readonly stings = new Map<StemSting, AudioBuffer>();
  readonly failures = new Set<string>();
  readonly sceneName = 'day';
  private bank: StyleBank | undefined;
  private decoding: MusicStyle | undefined;
  constructor(private readonly music: Pick<Music, 'genre' | 'refreshScore'>, private readonly scope: Scope, private readonly profile: AudioMusicProfile = PROFILE) {
    this.base = profile.base; this.synthLead = profile.synthLead; this.slots = profile.slots; this.minFade = profile.minFade;
  }
  get pending(): boolean { return this.decoding !== undefined; }
  target(_state: MusicState): string { return selectScoreSlots(this.profile.selection, this.profile.selectMode, {})[0] ?? this.base; }
  useBank(bank: Parameters<ScoreSource['useBank']>[0]): void {
    for (const [id, value] of bank.stings) this.stings.set(id, value);
  }
  useStyleBank(bank: StyleBank): void { this.bank = bank; this.stings.clear(); this.useBank(bank); }
  want(_playing: string | undefined): SlotAudio | undefined {
    const genre = this.music.genre;
    if (genre === 'synth' || this.scope.disposed) return undefined;
    if (this.bank?.genre === genre) return this.bank.slots.get(this.base);
    if (this.decoding === genre || this.failures.has(genre)) return undefined;
    this.decoding = genre;
    void this.prepare(genre);
    return undefined;
  }
  private async prepare(genre: MusicStyle): Promise<void> {
    try {
      const [{ decodeStyle }, { cachedBytes, decodeBytes }] = await Promise.all([import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/audio/preload')]);
      const bank = await decodeStyle(genre, this.profile.bootSlots, cachedBytes, decodeBytes);
      if (!this.scope.disposed && this.music.genre === genre) this.useStyleBank(bank);
    } catch { this.failures.add(genre); }
    finally {
      if (this.decoding === genre) this.decoding = undefined;
      if (!this.scope.disposed) this.music.refreshScore();
    }
  }
  dispose(): void { this.bank = undefined; this.stings.clear(); this.failures.clear(); }
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
