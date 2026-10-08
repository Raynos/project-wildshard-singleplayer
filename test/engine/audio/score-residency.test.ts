import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import { SetScore } from '../../../src/engine/audio/SetScore';
import type { SlotAudio, StyleBank } from '../../../src/engine/audio/Stems';

const slot = (id: string): SlotAudio => ({ genre: 'piano', slot: id,
  spec: { calm: `${id}.m4a`, tension: undefined, layers: [], phases: {}, bpm: 120, beatsPerBar: 4, loopStart: 0, loopEnd: 30, duration: 32 },
  calm: { duration: 32 } as AudioBuffer, tension: undefined, layers: [] });
const bank = (...slots: SlotAudio[]): StyleBank => ({ genre: 'piano', set: 'base',
  slots: new Map(slots.map(audio => [audio.slot, audio])), stings: new Map(), log: [] });

describe('decoded score residency', () => {
  it('reuses incoming recordings without retaining retired levels or a removed deferred bank', () => {
    const scope = new Scope('music.bank'), audio = withOwner(scope, () => new Audio());
    const music = withOwner(scope, () => new Music(audio));
    const title = slot('title'), first = slot('first'), second = slot('second');
    music.useBank(bank(title, first));
    music.useBank(bank(slot('title'), second));
    expect([...music.residentBank()?.slots.keys() ?? []]).toEqual(['title', 'second']);
    expect(music.residentBank()?.slots.get('title')).toBe(title);
    expect(music.residentBank()?.slots.get('first')).toBeUndefined();
    music.useBank(bank());
    expect(music.residentBank()?.slots.size).toBe(0);
    expect(audio.ready).toBe(false);
    scope.dispose();
  });

  it('releases the outgoing slot at deck handoff without requiring another scene refresh', () => {
    const scene = { slot: 'nd-market' }, first = slot('nd-market'), next = slot('nd-well');
    const score = new SetScore({ dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack', scene,
      pick: value => [value.slot], read: () => Promise.reject(new Error('Unexpected decode')),
      decode: () => Promise.reject(new Error('Unexpected decode')), onReady: () => undefined });
    score.useBank({ slots: new Map([[first.slot, first], [next.slot, next]]), stings: new Map() });
    // Match a declared set without needing device audio or a fresh decode.
    expect(score.slots).toContain('nd-market');
    scene.slot = 'nd-well';
    expect(score.want('nd-market')).toBe(next);
    expect(score.resident).toEqual(['nd-market', 'nd-well']);
    score.onDeck('nd-well');
    expect(score.resident).toEqual(['nd-well']);
    expect(first.calm.duration).toBe(32); // An outgoing Deck can still finish its scheduled fade.
    score.dispose(); expect(score.resident).toEqual([]);
  });
});
