import { expect, test, vi } from 'vitest';
import { parseAudioData } from '@wildshard/format/audio';
import { createCatalogueAudio } from '@wildshard/engine/audio/levelAudio';
import * as stems from '@wildshard/engine/audio/Stems';
import * as samples from '@wildshard/engine/audio/preload';
import * as settings from '@wildshard/engine/ui/Settings';
import source from '../src/shards/pine-hollow/data/audioSource.json' with { type: 'json' };

test('Pine keeps exact calm and inventory while only tension leaves the phone control set', async () => {
  const data = parseAudioData(source.audio);
  if (!data.music) throw new Error('Missing Pine music');
  const { controlTension, ...originalMusic } = data.music;
  expect(controlTension).toBe('late');
  const declared = await createCatalogueAudio(data), original = await createCatalogueAudio({ ...data, music: originalMusic });
  expect(declared.files()).toEqual(original.files());
  for (const style of ['piano', 'orchestral', 'folk'] as const) {
    const manifest = stems.musicManifest(style), pine = manifest?.slots['pine'];
    if (!pine?.tension) throw new Error('Missing original Pine pair');
    const calm = `/assets/music/${style}/${pine.calm}`, tension = `/assets/music/${style}/${pine.tension}`;
    const control = declared.controlFiles?.(style), before = original.controlFiles?.(style);
    expect(declared.bootFiles(style)).toEqual(original.bootFiles(style));
    expect(control).toContain(calm); expect(control).not.toContain(tension); expect(before).toContain(tension);
    expect(before?.filter(url => !url.endsWith(`/${pine.tension}`))).toEqual(control);
  }
  expect(() => parseAudioData({ ...source.audio, music: { ...source.audio.music, controlTension: 'missing' } })).toThrow();
});

test('the opted-in control decoder skips tension and the full after-control decoder still prepares it', async () => {
  const read = vi.fn<(url: string) => Promise<ArrayBuffer>>(() => Promise.reject(new Error('Unselected read')));
  const decode = vi.fn<(bytes: ArrayBuffer) => Promise<AudioBuffer>>(() => Promise.reject(new Error('Unexpected decode')));
  const prepare = vi.spyOn(stems, 'decodeStyle').mockResolvedValue({ genre: 'piano', set: 'base', slots: new Map(), stings: new Map(), log: [] });
  vi.spyOn(settings, 'getSfxSet').mockReturnValue('synth');
  vi.spyOn(samples, 'decodeSfxSet').mockResolvedValue({ set: 'synth', credit: undefined, loops: new Map(), shots: new Map() });
  try {
    const profile = await createCatalogueAudio(parseAudioData(source.audio));
    if (!profile.controlDecode) throw new Error('Missing declared control decoder');
    await profile.controlDecode('piano', read, decode);
    expect(prepare).toHaveBeenLastCalledWith('piano', ['title', 'pine'], read, decode, undefined, 'base', [], false);
    await profile.decode('piano', read, decode);
    expect(prepare).toHaveBeenLastCalledWith('piano', ['title', 'pine'], read, decode, undefined);
    expect(read).not.toHaveBeenCalled();
  } finally { vi.restoreAllMocks(); }
});
