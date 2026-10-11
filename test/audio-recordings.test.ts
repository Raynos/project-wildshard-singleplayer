// oxlint-disable-next-line import/no-nodejs-modules -- Admission checks the actual shipped recording bytes.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseAudioData } from '@wildshard/format/audio';
import { preflightAssetGraph, assetCost } from '@wildshard/format/product';
import { validateShardfileAssets } from '@wildshard/format/assetAdmission';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';
import folk from '../public/assets/music/folk/music.json' with { type: 'json' };

const path = `/assets/music/folk/${folk.stings.pickup}`;
const audio = { cues: [], ambience: null, score: 'silent' };
const hash = 'a'.repeat(64);

it('retains absent bindings and refuses unsafe catalogue identities, hashes and oversized tables', () => {
  expect(parseAudioData(audio)).not.toHaveProperty('recordings');
  for (const name of ['https://example.test/a.wav', '/assets/music/../a.wav', '/assets/sfx/test/../../a.wav', '/assets/music/test/a.wav?x=1', '/assets/music/test/%61.wav', '/assets/music/test/a.mp3']) {
    expect(() => parseAudioData({ ...audio, recordings: { [name]: hash } }), name).toThrow();
  }
  expect(() => parseAudioData({ ...audio, recordings: { [path]: 'https://example.test/audio' } })).toThrow();
  const recordings = Object.fromEntries(Array.from({ length: 1024 }, (_, i) => [`/assets/sfx/test/take-${i}.wav`, hash]));
  expect(Object.keys(parseAudioData({ ...audio, recordings }).recordings ?? {})).toHaveLength(1024);
  expect(() => parseAudioData({ ...audio, recordings: { ...recordings, '/assets/sfx/test/extra.wav': hash } })).toThrow('bounded audio');
});

it('charges local recordings once by hash and refuses uncharged or mislabeled audio before reads', () => {
  const bytes = Uint8Array.from(readFileSync(new URL(`../public${path}`, import.meta.url))), ref = contentHash(bytes);
  const shard = emptyShardfile({ slug: 'recording-test', name: 'Recording', author: 'Test', seed: 1, revision: 1 });
  const cost = assetCost('audio', bytes);
  shard.files = [{ hash: ref, kind: 'audio', compressed: bytes.length, ...cost, dependencies: [], critical: false }];
  shard.audio.recordings = { [path]: ref, '/assets/music/alias/pickup.m4a': ref };
  shard.critical = [ref];
  expect(() => preflightAssetGraph(shard)).toThrow('charged library');
  shard.critical = []; shard.library = [ref]; shard.budgets.library = { compressed: bytes.length, resident: cost.decoded };
  expect(validateShardfileAssets(shard, new Map([[ref, bytes]]), contentHash)).toEqual(shard);
  const file = shard.files[0]; if (file === undefined) throw new Error('Missing audio file');
  file.kind = 'binary'; expect(() => preflightAssetGraph(shard)).toThrow('declared audio');
});

it('refuses unknown commons references before reads and non-audio commons bytes after byte admission', () => {
  const bytes = new Uint8Array(12), ref = contentHash(bytes);
  const shard = emptyShardfile({ slug: 'recording-test', name: 'Recording', author: 'Test', seed: 1, revision: 1 });
  shard.audio.recordings = { [path]: `commons:${ref}` }; shard.library = [`commons:${ref}`];
  expect(() => preflightAssetGraph(shard)).toThrow('declared audio');
  shard.requires.commons = [ref]; shard.requires.commonsWire = { [ref]: bytes.length }; shard.requires.commonsCosts = { [ref]: assetCost('commons', bytes) };
  expect(() => preflightAssetGraph(shard)).not.toThrow();
  expect(() => validateShardfileAssets(shard, new Map([[`commons:${ref}`, bytes]]), contentHash)).toThrow('invalid WAV');
});
