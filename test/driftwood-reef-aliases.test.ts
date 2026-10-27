import { expect, test } from 'vitest';
import { REEF_FILES, reefFilesFrom } from '../src/shards/driftwood-isle/generators/reefFiles';
import { driftwoodReefBank } from '../src/shards/driftwood-isle/generators/reefBank';
import { hashImmutableBytes } from '../src/sdk/immutable';

const original = (hash: string, kind: string): string => {
  const root = '/assets/driftwood-isle/baked/';
  return `${root}reef-${hash}.${kind}`;
};
const expected = {
  "coral": {
    "default": original('02f2b47255677bc4a8cd39bd108b926f880c5537cd3b1cc2c1a6d7f19f4aab9c', 'glb'),
    "brain": original('02f2b47255677bc4a8cd39bd108b926f880c5537cd3b1cc2c1a6d7f19f4aab9c', 'glb'),
    "staghorn": original('572d17e81fc703118e1d90987463b8a564ffad60eaa675bd408858ed0c923f5b', 'glb'),
    "fan": original('9fbf2206037c0395af83166dfe7b68b090f8973b3a3ba3657b694d5758209841', 'glb'),
    "tube": original('51e9132044fad3eeb9d3aef9c66d946469bfbea505b8cfcaba65324df918b7fb', 'glb')
  },
  "weed": {
    "default": original('9b514bf9dc7b3d427ceab2a1f931e90818ddea3a70a6f7e4dcb5ca55415e9b51', 'glb'),
    "tint-0": original('9b514bf9dc7b3d427ceab2a1f931e90818ddea3a70a6f7e4dcb5ca55415e9b51', 'glb'),
    "tint-1": original('a0e8fa576978c14e5252dc37df430d6ade9aff4bef95a0887d0e7afb9ee58fc1', 'glb'),
    "tint-2": original('61f3569798f8fc19e5b2920e3f669c231f27eb6bfa2d42ae8caf42f9d225c3ba', 'glb'),
    "tint-3": original('3f47d6ebfe8205ec34f7719102d6f9e5d9a7373d78643a49d475793175f22b13', 'glb')
  },
  "star": {
    "default": original('45877f4c35af380f7d7e1acdfaf3637fc33b3f727fa0449be78484026132eff9', 'glb'),
    "tint-0": original('45877f4c35af380f7d7e1acdfaf3637fc33b3f727fa0449be78484026132eff9', 'glb'),
    "tint-1": original('c0858d03822e7b99f4f259ac5e3adff466f3e600d15a1d4021b7b8ed853bf719', 'glb'),
    "tint-2": original('75230cd7b309506697a43599b6ef36d0e69dd07f4de5bdc5482cc69b65009687', 'glb')
  },
  "world": original('2485e39982beb460e69e164562f178b6214cc080bedfa8e17281d8bd86a9f8f6', 'bin')
};

test('owned reef aliases retain every original content identity and choice', () => {
  expect(REEF_FILES).toEqual(expected);
  const bank = driftwoodReefBank();
  for (const [url, name] of Object.entries(bank.byUrl)) {
    const blob = bank.blobs.get(name);
    if (blob === undefined) throw new Error(`Missing owned reef blob: ${name}`);
    expect(url).toBe(original(hashImmutableBytes(blob.bytes), blob.kind));
  }
});

test('reef alias admission refuses missing and duplicate owned content', () => {
  const byUrl = { ...driftwoodReefBank().byUrl }, url = REEF_FILES.coral.default;
  const name = byUrl[url];
  if (name === undefined) throw new Error('Missing original reef alias');
  delete byUrl[url];
  expect(() => reefFilesFrom(byUrl)).toThrow('needs one owned alias');
  byUrl[url] = name;
  byUrl[`/duplicate${url}`] = name;
  expect(() => reefFilesFrom(byUrl)).toThrow('needs one owned alias');
});
