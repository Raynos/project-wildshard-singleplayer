import { expect, it } from 'vitest';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { bootSources, worldReads } from '../../../src/shards/pine-hollow/boot/files';
import before from './boot-before.json';
import bakedCoats from '../../../src/shards/pine-hollow/generators/bake-pine-coats.json';
import bakedViewmodel from '../../../scripts/bake-viewmodel-sets.json';
import coatPages from '../../../src/shards/pine-hollow/data/coatPages.generated.json';

/** G187 cut 2: the coats baked to KTX2 (scripts/bake-coats.mjs) ride the KTX2 lists only, never the image ones */
const COAT = /^\/assets\/gpu\/pine-hollow\/creatures\/coats\/[^/]+\.ktx2$/u;
/** G320: offline, lossless coat pages replace runtime painting and are a separately checked boot addition. */
const COAT_IMAGE = /^\/assets\/pine-hollow\/creatures\/[^/]+\.coat\.png$/u;
/** G187 cut 3: the weapon viewmodel sets baked to KTX2 (scripts/bake-viewmodel-sets.mjs), likewise KTX2 lists only */
const VIEWMODEL = /^\/assets\/gpu\/baked\/pine-hollow\/viewmodel\/[^/]+\.ktx2$/u;

it.each(['phone', 'desktop'] as const)('preserves the frozen %s image and KTX2 boot lists', (tier) => {
  for (const tex of ['img', 'ktx2'] as const) {
    const sources = bootSources(tier, tex), added = worldReads(tier, tex);
    const coats = sources.props.filter((url) => COAT.test(url)), sets = sources.props.filter((url) => VIEWMODEL.test(url));
    expect({ ...sources, props: sources.props.filter((url) => !added.includes(url) && !COAT.test(url) && !COAT_IMAGE.test(url) && !VIEWMODEL.test(url)) }).toEqual(before[tier][tex]);
    expect(added).toHaveLength(17); // G285: the cabins', this tier's crag skin, the streams', the lookout's, the site timbers' and the wildlife's bakes among them
    expect(added.every((url) => sources.props.includes(url))).toBe(true);
    expect(coats.slice().sort()).toEqual(tex === 'ktx2' ? Object.values(bakedCoats[tier]).sort() : []);
    expect(coats).toHaveLength(tex === 'ktx2' ? 16 : 0);
    const images = sources.props.filter(url => COAT_IMAGE.test(url));
    expect(images).toEqual(tex === 'img' ? Object.keys(coatPages.tiers[tier]).sort().map(key => {
      const page = (coatPages.tiers[tier] as Readonly<Record<string, { image: string }>>)[key];
      if (page === undefined) throw new Error('Missing declared Pine coat image');
      return page.image;
    }) : []);
    expect(images).toHaveLength(tex === 'img' ? 16 : 0);
    expect(sets).toEqual(tex === 'ktx2' ? Object.values(bakedViewmodel[tier]).sort() : []);
    expect(sets).toHaveLength(tex === 'ktx2' ? 12 : 0);
  }
  const declared = PINE_HOLLOW.boot?.files(tier) ?? [];
  expect(Object.values(before[tier].img).flat().every((url) => declared.includes(url))).toBe(true);
  expect(worldReads(tier).every((url) => declared.includes(url))).toBe(true);
});
