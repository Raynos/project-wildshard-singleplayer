// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the producer's existing immutable cache, not loose generated assets.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Existing explicit producer cache location.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { pineGeneration } from './fixtures/pine-generation';
import { pineBirds } from '../src/shards/pine-hollow/generators/birdInputs';
import { phoneBirdsAtlasOutput } from '../src/shards/pine-hollow/generators/birdAtlas';
import { wildlifeDraw } from '../src/shards/pine-hollow/generators/wildlifeDraw';
import { tierLibrarySteps } from '../src/format/tierSelection';

const context = pineGeneration('pine-bird-device-selection', resolve(homedir(), '.cache/wildshard/gen'));
const birds = await pineBirds(context), atlas = await phoneBirdsAtlasOutput(context);
const files = [...birds.files.files, ...atlas.files];
const source = { identity: { slug: 'pine-hollow' }, files, library: files.map(file => file.hash), critical: [] };
const draw = wildlifeDraw(birds.ranges);

for (const tier of ['phone', 'desktop'] as const) test(`${tier} admission keeps only its actual live and Explorer bird sources`, () => {
  // Both devices remain in the same authored row. A conservative string walk
  // cannot turn the unused device's atlas into an early transport/pack member.
  const descriptor = { index: { files }, sections: new Map<string, unknown>([['look/wildlife', draw]]) };
  const walk = tierLibrarySteps(source, tier, descriptor); let next = walk.next(); while (!next.done) next = walk.next();
  const selected = files.filter(file => !next.value.has(file.hash));
  expect(new Set(selected.map(file => file.name))).toEqual(new Set(tier === 'phone'
    ? ['models/life/birds.phone.glb', 'models/life/birds-rest.phone.glb', 'models/life/birds.phone.base.ktx2']
    : ['models/life/birds.glb', 'models/life/birds-rest.glb', 'models/life/birds.base.ktx2']));
  expect(selected.map(file => file.name)).toContain(draw.tiers[tier].geometry);
  expect(selected.map(file => file.name)).toContain(draw.tiers[tier].atlas);
  expect(files).toHaveLength(6);
});
