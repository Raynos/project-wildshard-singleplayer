import { describe, expect, it } from 'vitest';
import { decodeSfxSet, sfxFiles } from '#engine/audio/preload';
import { FOREST_AUDIO } from '../../../src/shards/pine-hollow/audio/profile';

const read = (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(1));
const decode = (): Promise<AudioBuffer> => Promise.resolve({ duration: 60 } as AudioBuffer);
describe('level sample selection', () => {
  it('keeps Pine exclusion with any bed id, while another level using forest can include the same sounds', async () => {
    const pine = await decodeSfxSet('best', 'forest', read, undefined, decode, FOREST_AUDIO.samples);
    const renamed = await decodeSfxSet('best', 'island', read, undefined, decode, FOREST_AUDIO.samples);
    const other = await decodeSfxSet('best', 'forest', read, undefined, decode, { loopGains: { forest: 0.5 } });
    for (const bank of [pine, renamed]) {
      expect(bank.loops.has('shrine')).toBe(false);
      expect(bank.shots.has('gull')).toBe(false);
      expect(bank.shots.has('crab_click')).toBe(false);
      expect(bank.shots.has('crossbowFire')).toBe(true);
    }
    expect(other.loops.has('shrine')).toBe(true);
    expect(other.shots.has('gull')).toBe(true);
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
