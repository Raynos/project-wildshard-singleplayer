import { describe, expect, it, vi } from 'vitest';
import { installSilentScore } from '@wildshard/sdk/runtime/audio/silentScore';
import { Scope } from '../../src/engine/app/scope';
import { createForestAudio, installForestAmbience } from '../../src/game/systems/audio/forest';

describe('asset-free forest audio profile', () => {
  it('mutes only the score output and restores it on level disposal', () => {
    const scope = new Scope('contract.silent-score');
    const music = { out: { gain: { value: 0.7 } } }, master = { gain: { value: 0.9 } };
    installSilentScore(music, scope);
    expect(music.out.gain.value).toBe(0); expect(master.gain.value).toBe(0.9);
    scope.dispose(); expect(music.out.gain.value).toBe(0.7);
  });
  it('starts the forest bed lazily and disconnects it when the owner is disposed', () => {
    const scope = new Scope('contract.forest-bed'), disconnect = vi.fn();
    let start: () => void = () => undefined;
    const restart = vi.fn<(id: string) => void>();
    const wind = vi.fn(() => ({ disconnect }));
    installForestAmbience({ installSynthBed: (id, bed, owner) => {
      expect(id).toBe('forest'); start = bed.start; owner.onDispose(bed.stop);
    }, restartSynthBed: restart, mkWind: wind }, scope);
    expect(restart).toHaveBeenCalledWith('forest'); expect(wind).not.toHaveBeenCalled();
    start(); expect(wind).toHaveBeenCalledTimes(2);
    scope.dispose(); expect(disconnect).toHaveBeenCalledTimes(2);
  });
  it('requests no files and decodes no sampled score or cue banks', async () => {
    const profile = createForestAudio();
    expect(profile.files()).toEqual({ music: [], sfx: [] });
    expect(profile.bootFiles('folk')).toEqual([]);
    const unexpected = () => Promise.reject(new Error('Asset-free profile requested data'));
    const bank = await profile.decode('folk', unexpected, unexpected);
    expect(bank.score.slots.size).toBe(0); expect(bank.cues.loops.size).toBe(0); expect(bank.cues.shots.size).toBe(0);
  });
});
