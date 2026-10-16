import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { absentShardProduct, createShardProduct } from '../src/game/shardfile/shardProduct';
import { pineAudioProfile } from '../src/shards/pine-hollow/runtime/audio/profile';
import { createPineAudio } from '../src/shards/pine-hollow/runtime/audio/files';
import { PINE_AUDIO } from '../src/shards/pine-hollow/data/audio';

const shardfile = emptyShardfile({ slug: 'pine-audio-test', name: 'Audio test', author: 'Wildshard', revision: 1, seed: 1 });
function product(audio: typeof PINE_AUDIO) {
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['audio/audio', { audio }]]), files: new Map(),
    read: () => Promise.reject(new Error('No audio bytes expected')) });
}

test('Pine samples and fallback wind belong to the admitted entry, with required-profile refusals', async () => {
  const samples = PINE_AUDIO.samples, ambience = PINE_AUDIO.ambience;
  if (samples === undefined || ambience === null) throw new Error('Shipping Pine audio profiles missing');
  const changed = { ...PINE_AUDIO, samples: { ...samples, bed: 'entry-bed', loopGains: { creek: 0.37 } },
    ambience: { ...ambience, bed: 'entry-wind' } };
  const result = pineAudioProfile(product(changed));
  expect(result.bed).toBe('entry-bed');
  expect(result.samples.loopGains).toEqual({ creek: 0.37 });
  expect(result.wind).toBe(changed.ambience);
  expect(() => pineAudioProfile(product({ ...PINE_AUDIO, samples: undefined }))).toThrow('pine.samples');
  expect(() => pineAudioProfile(product({ ...PINE_AUDIO, ambience: null }))).toThrow('ambience.pine.wind');
  expect(() => pineAudioProfile(absentShardProduct('pine-audio-test'))).toThrow('no built shard');
  await expect(createPineAudio(absentShardProduct('pine-audio-test'))).rejects.toThrow('no built shard');
});

