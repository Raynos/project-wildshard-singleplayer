import { describe, expect, it } from 'vitest';
import { NO_AUDIO } from '#engine-internal/audio/levelAudio';

// E357 G19 (Sky Reach Z3 round 3): a shard with no audio files omits audio.preload and boots on NO_AUDIO
describe('NO_AUDIO', () => {
  it('lists no files and decodes to an empty bank', async () => {
    expect(NO_AUDIO.files()).toEqual({ music: [], sfx: [] });
    expect(NO_AUDIO.bootFiles('dynamic' as never)).toEqual([]);
    const bank = await NO_AUDIO.decode('dynamic' as never, () => Promise.reject(new Error('no reads')), () => Promise.reject(new Error('no decodes')));
    expect(bank.title).toBeUndefined();
    expect(bank.score.slots.size + bank.cues.loops.size + bank.cues.shots.size).toBe(0);
  });
});
