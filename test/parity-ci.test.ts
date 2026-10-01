import { afterEach, describe, expect, it, vi } from 'vitest';
import baselineFixture from './fixtures/parity/baseline.json';
import { compare } from '../scripts/parity/compare.mjs';
import { compareOffline, failureReasons } from '../scripts/parity/offline.mjs';
import { walkStep } from '../scripts/parity/walk.mjs';
import { object, type RecordValue } from '../scripts/parity/value.mjs';

const offlineCapture = (): RecordValue => ({
  boot: { ...object(baselineFixture.boot), lane: 'gh-macos15',
    saves: { read: ['local:wildshard.save.v2.pine-hollow'], written: [] } },
  offline: { title: true, play: true, explore: true },
});

describe('CI offline boot contract', () => {
  it('passes a successful offline capture after gameplay baselines exist', () => {
    const captured = offlineCapture();
    // Reproduce the bootstrap-only failure: the full run has poses, sounds and a different save-read trajectory.
    expect(compare(baselineFixture, captured).verdict).toBe('red');
    expect(compareOffline(captured).verdict).toBe('green');
    expect(failureReasons(compareOffline(captured))).toEqual([]);
  });

  it.each(['title', 'play', 'explore'])('fails when the offline %s stage is absent or false', (stage) => {
    for (const value of [undefined, false]) {
      const captured = offlineCapture();
      captured['offline'] = { ...object(captured['offline']), [stage]: value };
      const checked = compareOffline(captured);
      expect(checked.verdict).toBe('red');
      expect(failureReasons(checked)).toEqual([`offline.${stage}: observed ${JSON.stringify(value ?? null)}; expected completed offline`]);
    }
  });

  it('still fails real page errors, missing error observations and invalid renderers', () => {
    for (const boot of [
      { errors: ['Importing a module script failed'] },
      { errors: undefined },
      { renderer: 'no WebGL2' },
      { scene: { totals: { batched: -1 } } },
    ]) {
      const captured = offlineCapture();
      captured['boot'] = { ...object(captured['boot']), ...boot };
      expect(compareOffline(captured).verdict).toBe('red');
      expect(failureReasons(compareOffline(captured)).join('\n')).toContain('boot.');
    }
  });
});

describe('CI walk step budgets', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('allows progressing route legs to take longer together than one leg budget', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const name of ['cabin-porch', 'lookout-climb', 'creek-bridge', 'touch']) {
      const step = walkStep(() => new Promise<string>((resolve) => { setTimeout(() => { resolve(name); }, 170_000); }), 240_000, `pine-hollow.phone walk ${name}`);
      await vi.advanceTimersByTimeAsync(170_000);
      expect(await step).toBe(name);
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(console.error).toHaveBeenCalledWith('parity: pine-hollow.phone walk touch finished in 170.0s');
  });

  it('fails a stalled leg within its budget and names the exact step', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stalled = walkStep(() => new Promise<void>(() => { /* deliberately never finishes */ }), 240_000, 'pine-hollow.phone walk creek-bridge');
    const rejected = expect(stalled).rejects.toThrow('infrastructure: pine-hollow.phone walk creek-bridge did not finish within 240s');
    await vi.advanceTimersByTimeAsync(240_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves a real gameplay failure rather than classifying it as runner slowness', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(walkStep(() => Promise.reject(new Error('walk probe failed')), 240_000, 'walk cabin-porch')).rejects.toThrow('walk probe failed');
  });
});
