import { expect, test } from 'vitest';
import { checkTileMaterialNames, splatTerrainOf, splatTextureRefs } from '@wildshard/format/splatTerrain';
import { preflightDeclaredCosts } from '@wildshard/format/assetAdmission';
import { PINE as product, PINE_ASSETS } from './fixtures/pine-program';
import { PINE_SOURCES } from './fixtures/pine-sources';
import { timberWorld } from '../src/shards/pine-hollow/generators/timberWorldRows';

const timbers = timberWorld(PINE_SOURCES);

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
    // the ground GLB's bytes as the program handed them to the product (ctx.asset), never a file
    const bytes = PINE_ASSETS.get(tile.file); if (bytes === undefined) throw new Error('ground bytes missing');
    checkTileMaterialNames(undefined, splat, bytes);
  }
  expect(splat.phone).toBeDefined(); // Pine's phone draws its ASTC 6x6 ground layers
  // every tile's declared cost covers its closure (the ground GLB, its layer KTX2s, the timber), as the build admits it
  expect(() => preflightDeclaredCosts(product)).not.toThrow();
});
