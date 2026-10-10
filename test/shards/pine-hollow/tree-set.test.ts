import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The shipped tree set is a committed public folder.
import { existsSync, statSync } from 'node:fs';
import { treeSetUrls } from '../../../src/engine/world/forest/treeSet';
import { PINE_TREE_ASSETS } from '../../../src/shards/pine-hollow/world/treeAssets';
import { PINE_TREE_SET } from '../../../src/shards/pine-hollow/world/treeSet';

describe('Pine Hollow ships its tree set (G285: no procedural fallback)', () => {
  it('every file the factory loads is committed under public/', () => {
    expect(PINE_TREE_ASSETS.set).toBe('pine-hollow-trees');
    expect(PINE_TREE_ASSETS.setVariants).toBe(PINE_TREE_SET);
    for (const url of Object.values(treeSetUrls(PINE_TREE_ASSETS.set))) {
      const path = new URL(`../../../public${url}`, import.meta.url);
      expect(existsSync(path), url).toBe(true);
      expect(statSync(path).size, url).toBeGreaterThan(1024);
    }
  });
});
