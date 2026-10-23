// oxlint-disable-next-line import/no-nodejs-modules -- the committed ground tile GLBs are the product's files.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { checkTileMaterialNames, splatTerrainOf, splatTextureRefs } from '@wildshard/format/splatTerrain';
import { preflightDeclaredCosts } from '@wildshard/format/assetAdmission';
import product from '../src/shards/pine-hollow/generators/product';
import timbers from '../src/shards/pine-hollow/data/timberWorld.generated.json' with { type: 'json' };

// Tile streaming P1: Pine's product carries its splat ground on all 64 L0 props tiles and its coarse ground on the 16 L1, the timber after it on its 12 L0 tiles,
// and admits (parseShardfile ran at import): the ground GLBs draw only the splat material beside the family timber.
test('the ground joins every props tile, the timber after it', () => {
  const props = product.props; if (props === null) throw new Error('Pine has props');
  const splat = splatTerrainOf(props); if (splat === undefined) throw new Error('Pine declares its splat ground');
  expect(props.tiles).toHaveLength(80);
  expect(props.tiles.filter(tile => tile.lod === 0)).toHaveLength(64);
  for (const timber of timbers.props.tiles) {
    const tile = props.tiles.find(row => row.lod === timber.lod && row.x === timber.x && row.z === timber.z);
    expect(tile?.additionalFiles).toEqual([timber.file]);
  }
  const files = new Map(product.files.map(file => [file.hash, file]));
  for (const tile of props.tiles) {
    const file = files.get(tile.file); if (file === undefined) throw new Error('ground file missing');
    // L0 draws the splat layers; L1 its own colours, with no dependency (a coarse tile may not reach the library)
    expect(tile.lod === 0 ? splatTextureRefs(splat).every(ref => file.dependencies.includes(ref)) : file.dependencies.length === 0).toBe(true);
    checkTileMaterialNames(undefined, splat, new Uint8Array(readFileSync(new URL(`../src/shards/pine-hollow/assets/${tile.file}`, import.meta.url))));
  }
  expect(splat.phone).toBeDefined(); // Pine's phone draws its ASTC 6x6 ground layers
  // every tile's declared cost covers its closure (the ground GLB, its layer KTX2s, the timber), as the build admits it
  expect(() => preflightDeclaredCosts(product)).not.toThrow();
});
