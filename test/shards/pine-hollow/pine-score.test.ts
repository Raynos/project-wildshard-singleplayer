import { describe, expect, it, vi } from 'vitest';
import { Scope, type MusicState, type SlotAudio } from '#engine';
import { PineScore } from '#shards/pine-hollow/audio/score';

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
});
