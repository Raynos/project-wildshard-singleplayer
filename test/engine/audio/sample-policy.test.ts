import { describe, expect, it } from 'vitest';
import { decodeSfxSet, sfxFiles } from '../../../src/engine/audio/preload';
import { FOREST_AUDIO } from '../../../src/shards/pine-hollow/audio/profile';

const read = (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(1));
const decode = (): Promise<AudioBuffer> => Promise.resolve({ duration: 60 } as AudioBuffer);
describe('level sample selection', () => {
  it('keeps island-only sounds in their own set and Pine gains independent of the bed name', async () => {
    const pine = await decodeSfxSet('best', 'forest', read, undefined, decode, FOREST_AUDIO.samples);
    const renamed = await decodeSfxSet('best', 'island', read, undefined, decode, FOREST_AUDIO.samples);
    const other = await decodeSfxSet('best', 'forest', read, undefined, decode, { loopGains: { forest: 0.5 } });
    const island = await decodeSfxSet('driftwood-isle', 'island', read, undefined, decode);
    for (const bank of [pine, renamed, other]) {
      expect(bank.loops.has('shrine')).toBe(false);
      expect(bank.shots.has('gull')).toBe(false);
      expect(bank.shots.has('crab_click')).toBe(false);
      expect(bank.shots.has('crossbowFire')).toBe(true);
    }
    expect(island.loops.has('shrine')).toBe(true);
    expect(island.shots.has('gull')).toBe(true);
    expect(island.shots.has('crab_click')).toBe(true);
    expect(island.loops.has('forest')).toBe(false);
    expect(pine.loops.get('forest')?.gain).toBe(0.25);
    expect(pine.loops.get('underwater')?.gain).toBe(0.25);
    expect(pine.loops.get('pickup')?.gain).toBeCloseTo(0.1225);
    expect([...pine.shots.keys()]).toEqual([...renamed.shots.keys()]);
  });
  it('lists exactly the selected decoder reads in the same order', async () => {
    const urls: string[] = [];
    await decodeSfxSet('best', FOREST_AUDIO.bed, (url) => { urls.push(url); return read(); }, undefined, decode, FOREST_AUDIO.samples);
    expect([...new Set(urls)]).toEqual(sfxFiles('best', FOREST_AUDIO.bed, FOREST_AUDIO.samples));
  });
});
