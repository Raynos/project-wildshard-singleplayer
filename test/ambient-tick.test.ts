import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Audio } from '#engine/audio/Audio';
import { ambientTick, tap } from '#engine/core/harnessTap';

afterEach(() => { tap.sound = null; tap.ambientDepth = 0; });

describe('ambient tick boundaries', () => {
  it('suppresses the real Audio.animal event tap inside a scheduler but records the same gameplay cue outside it', () => {
    const ids: string[] = [];
    tap.sound = (id, kind) => { if (kind === 'ambient' || tap.ambientDepth === 0) ids.push(id); };
    const audio = new Audio(); // before a gesture: no AudioContext, but cue-entry taps still run
    const p = new Vector3();
    ambientTick('steppe.herd', () => { audio.animal('horse_neigh', p, p); });
    expect(ids).toEqual(['steppe.herd']);
    audio.animal('horse_neigh', p, p);
    expect(ids).toEqual(['steppe.herd', 'animal:horse_neigh']);
    expect(tap.ambientDepth).toBe(0);
  });
  it('logs gated ticks first and restores nested depth when a body throws', () => {
    const calls: [string, number][] = [];
    tap.sound = (id) => { calls.push([id, tap.ambientDepth]); };
    expect(() => { ambientTick('outer', () => { ambientTick('inner', () => { throw new Error('body'); }); }); }).toThrow('body');
    expect(calls).toEqual([['outer', 0], ['inner', 1]]);
    expect(tap.ambientDepth).toBe(0);
  });
  it('does not need an installed harness', () => {
    tap.sound = null;
    let ran = false;
    ambientTick('silent', () => { ran = true; });
    expect(ran).toBe(true);
    expect(tap.ambientDepth).toBe(0);
  });
});
