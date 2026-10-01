import { afterEach, describe, expect, it, vi } from 'vitest';
import { Audio } from '#engine/audio/Audio';
import { Scope } from '#engine/app/scope';
import { setSfxSet } from '#engine/ui/Settings';
import type { SfxBank } from '#engine/audio/preload';
import type * as Preload from '#engine/audio/preload';

vi.mock('#engine/audio/preload', async (original) => ({
  ...await original<typeof Preload>(),
  decodeSfxSet: (set: string): Promise<SfxBank> => Promise.resolve({ set, credit: undefined, loops: new Map(), shots: new Map() }),
}));

afterEach(() => { vi.restoreAllMocks(); });
describe('owned sample decoder', () => {
  it('uses the current decoder on set changes and releasing an old scope preserves its replacement', async () => {
    const audio = new Audio(), first = new Scope('first-decoder'), second = new Scope('second-decoder');
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
  });
});
