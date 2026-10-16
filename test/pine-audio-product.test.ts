import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { absentShardProduct, createShardProduct } from '../src/game/shardfile/shardProduct';
import {productAudioCatalogue} from '../src/game/shardfile/audioCatalogue';
import AUDIO from '../src/shards/pine-hollow/data/audio.generated.json' with { type: 'json' };
import { parseAudioData } from '@wildshard/format/audio';

const PINE_AUDIO = parseAudioData(AUDIO.audio);

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
  expect(product(changed).section('audio/audio').audio.samples?.bed).toBe('entry-bed');
  expect(product(changed).section('audio/audio').audio.ambience).toBe(changed.ambience);
  await expect(productAudioCatalogue('pine-audio-test',absentShardProduct('pine-audio-test'))).rejects.toThrow('no built shard');
});

