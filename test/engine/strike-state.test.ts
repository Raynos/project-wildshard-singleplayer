import { describe, expect, it } from 'vitest';
import { StrikeRunner } from '../../src/engine/ai/strikes';
import { readStrikeState } from '../../src/engine/ai/strikeState';
import { RAM } from '../fixtures/grazer-oracle/goat';

describe('policy strike continuation admission', () => {
  it('accepts the runner continuation without changing it', () => {
    const state = new StrikeRunner().snapshot();
    expect(readStrikeState(state, [RAM])).toEqual(state);
  });
  it('rejects unknown and duplicate cooldown references', () => {
    const state = new StrikeRunner().snapshot();
    expect(() => readStrikeState({ ...state, deadlines: [{ id: 'other', at: 3 }] }, [RAM])).toThrow();
    expect(() => readStrikeState({ ...state, deadlines: [{ id: RAM.id, at: 3 }, { id: RAM.id, at: 4 }] }, [RAM])).toThrow();
    expect(() => readStrikeState({ ...state, scores: [{ id: 'other', score: 1 }] }, [RAM])).toThrow();
  });
  it('rejects nonfinite clocks and an active phase without its admitted strike', () => {
    const state = new StrikeRunner().snapshot();
    expect(() => readStrikeState({ ...state, elapsed: Infinity }, [RAM])).toThrow();
    expect(() => readStrikeState({ ...state, phase: 'active', currentId: 'other' }, [RAM])).toThrow();
  });
});
