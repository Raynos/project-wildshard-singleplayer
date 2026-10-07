import { afterEach, describe, expect, it, vi } from 'vitest';
import { Audio } from '../../../src/engine/audio/Audio';
import { Scope } from '../../../src/engine/app/scope';
import { isDev, setDev } from '../../../src/engine/core/devMode';
import { setSfxSet } from '../../../src/engine/ui/Settings';
import type { SfxBank } from '../../../src/engine/audio/preload';


afterEach(() => { vi.restoreAllMocks(); });
describe('owned sample decoder', () => {
  it('uses the current decoder on set changes and releasing an old scope preserves its replacement', async () => {
    const previous = isDev(); setDev(true);
    try {
      // the fallback decoder is the Audio's own option, not a mocked module (E422)
      const audio = new Audio({ decode: (set) => Promise.resolve({ set, credit: undefined, loops: new Map(), shots: new Map() }) }), first = new Scope('first-decoder'), second = new Scope('second-decoder');
      const bank = (set: string): SfxBank => ({ set, credit: undefined, loops: new Map(), shots: new Map() });
      const old = vi.fn((set: string) => Promise.resolve(bank(set))), own = vi.fn((set: string) => Promise.resolve(bank(set)));
      const used = vi.spyOn(audio, 'useSamples');
      audio.installSampleDecoder(old, first);
      audio.installSampleDecoder(own, second);
      first.dispose();
      setSfxSet('synth');
      await vi.waitFor(() => { expect(used).toHaveBeenCalledWith(bank('synth')); });
      expect(old).not.toHaveBeenCalled();
      expect(own).toHaveBeenCalledWith('synth');
      second.dispose();
      setSfxSet('best');
      await vi.waitFor(() => { expect(used).toHaveBeenCalledWith(bank('best')); });
      expect(own).toHaveBeenCalledTimes(1);
    } finally { setSfxSet('best'); setDev(previous); }
  });
});
