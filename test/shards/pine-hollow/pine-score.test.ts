import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import type { MusicState } from '../../../src/engine/audio/Music';
import type { SlotAudio } from '../../../src/engine/audio/Stems';
import * as stems from '../../../src/engine/audio/Stems';
import { PineScore } from '../../../src/shards/pine-hollow/runtime/audio/score';

const pcm = new Float32Array(48000);
const buffer: AudioBuffer = { duration: 1, length: 48000, numberOfChannels: 1, sampleRate: 48000,
  getChannelData: () => pcm, copyFromChannel: (dest) => { dest.set(pcm.subarray(0, dest.length)); }, copyToChannel: (source) => { pcm.set(source); } };
const theme: SlotAudio = { genre: 'piano', slot: 'pine', spec: { calm: 'theme.m4a', tension: undefined, layers: [], phases: {}, bpm: 96, beatsPerBar: 4, loopStart: 0, loopEnd: 1, duration: 1 }, calm: buffer, tension: undefined, layers: [] };
function host() {
  const state: MusicState = { mode: 'calm', intensity: 0, underwater: false };
  return { genre: 'piano' as const, state, refreshScore: vi.fn(), combat: vi.fn(), sting: vi.fn() };
}

describe('Pine score policy', () => {
  it('uses the decoded day theme and preserves scene, phase and bar refresh requests', () => {
    const music = host(), score = new PineScore(music);
    score.useBank({ slots: new Map([['pine', theme]]), stings: new Map([['chunk', buffer]]) });
    expect(score.want(undefined)).toBe(theme);
    score.setPineScene('night'); expect(score.target(music.state)).toBe('night');
    score.setPineScene('boss'); score.setBossPhase(3);
    expect(score.target(music.state)).toBe('boss'); expect(score.phase).toBe(3);
    score.setPineScene('day'); score.setPineScene('boss'); expect(score.phase).toBe(1);
    expect(music.refreshScore).toHaveBeenCalledTimes(5);
    score.playSting('chunk'); expect(music.sting).toHaveBeenCalledWith('chunk');
  });
  it('releases resident score buffers and suppresses further loading when its level scope ends', () => {
    const music = host(), score = new PineScore(music), scope = new Scope('pine.score.test');
    score.attach(scope); score.useBank({ slots: new Map([['pine', theme]]), stings: new Map([['chunk', buffer]]) });
    expect(score.stings.size).toBe(1); scope.dispose();
    expect(score.stings.size).toBe(0); expect(score.want(undefined)).toBeUndefined(); expect(score.pending).toBe(false);
  });
  it.each(['theme', 'dawn'])('refuses a late %s decode from the previous entry after the retained score reattaches', async (kind) => {
    const music = host(), score = new PineScore(music), first = new Scope('pine.score.first'), second = new Scope('pine.score.second');
    let finish: (bank: stems.StyleBank) => void = () => { throw new Error('Decode was not requested'); };
    const decode = vi.spyOn(stems, 'decodeStyle').mockImplementation(() => new Promise<stems.StyleBank>((resolve) => { finish = resolve; }));
    score.attach(first);
    const sting = kind === 'dawn' ? score.sting('dawn') : undefined;
    if (kind === 'theme') score.want(undefined);
    try {
      await vi.waitFor(() => { expect(decode).toHaveBeenCalledOnce(); });
      first.dispose(); score.attach(second);
      finish({ genre: 'piano', slots: new Map([['pine', theme]]), stings: new Map([['dawn', buffer], ['chunk', buffer]]) });
      if (sting !== undefined) expect(await sting).toBeUndefined();
      else await vi.waitFor(() => { expect(score.pending).toBe(false); });
      expect(score.stings.size).toBe(0); expect(music.refreshScore).not.toHaveBeenCalled();
    } finally { first.dispose(); second.dispose(); decode.mockRestore(); }
  });
});
