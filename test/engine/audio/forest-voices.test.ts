import { afterEach, describe, expect, it, vi } from 'vitest';
import { Audio } from '../../../src/engine/audio/Audio';
import { Scope } from '../../../src/engine/app/scope';
import { audioRandom, bindAudioRandom } from '../../../src/engine/audio/util';
import { tap } from '../../../src/engine/core/harnessTap';
import { Rng } from '../../../src/engine/core/rng';
import { installForestVoices } from '../../../src/shards/pine-hollow/runtime/audio/synth';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); tap.sound = null; const rng = new Rng(0); bindAudioRandom(() => rng.next()); });
describe('Pine fallback bed', () => {
  it('keeps wind bands, RNG start order and ambient callback taps, then cancels both schedulers on unload', () => {
    vi.useFakeTimers();
    const a = new Audio(), scope = new Scope('forest-test'), ids: [string, string | undefined][] = [];
    let draws = 0;
    bindAudioRandom(() => { draws++; return 0.5; });
    const mkWind = vi.spyOn(a, 'mkWind').mockImplementation(() => { audioRandom(); return { gain: { value: 0 } } as GainNode; });
    tap.sound = (id, kind) => { ids.push([id, kind]); };
    const bed = installForestVoices(a, scope);
    bed.start();
    expect(mkWind.mock.calls).toEqual([
      [260, 0.5, -0.55, 0.07, 0.11], [620, 0.8, 0.55, 0.11, 0.06],
      [140, 0.4, 0, 0.05, 0.09], [2400, 0.5, 0.2, 0.09, 0.012],
    ]);
    expect(draws).toBe(6); // four wind offsets, then gust wait, then bird wait
    a.ambientOn = false;
    vi.advanceTimersByTime(8000);
    expect(ids).toEqual([['audio.startForest', undefined], ['audio.bird', 'ambient']]);
    vi.advanceTimersByTime(500);
    expect(ids[2]).toEqual(['audio.gust', 'ambient']);
    expect(draws).toBe(8); // each muted callback still draws its next wait
    scope.dispose();
    vi.advanceTimersByTime(30000);
    expect(draws).toBe(8);
    expect(ids).toHaveLength(3);
  });
});
