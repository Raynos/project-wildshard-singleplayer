import { installRequiredGroundLoader } from '@wildshard/engine/world/bakedTerrainField';
import { installBakedSamplesReader } from '@wildshard/engine/world/BakedTerrain';
import { bilinearTerrainSamplers, decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { clientGround } from './clientGround';
import { admittedRuntimeProduct, firstPartyDescriptor, runtimeProduct, slugRuntimeProduct, type RuntimeProduct } from './runtimeProduct';
import { selectedLevel } from '@wildshard/engine/level/selection';
import { findShard } from '../shard/registry';
import { shardEntry } from '../shard/entryMode';

/**
 * The game session's required-ground loader (E434: `startSession` installs it; importing this module installs nothing). A
 * manifest ground declared by key (`createBakedTerrainField({ key, seed })`) is its shard's own admitted product: the
 * terrain collider its grid cell admitted and handed its resident runtime (`provideRuntimeProduct`), read as the client
 * ground reads it (`clientGround`: heights, normals and splat). No product, no collider or a product of another seed refuses
 * the level; a standalone page's painter binds the same collider itself (`PainterField.bindGround`). Returns the restore.
 */
export function installProductGround(): () => void {
  return installRequiredGroundLoader(async (declared) => {
    const product = admittedRuntimeProduct(declared.key);
    if (product === null) throw new Error(`Required ground ${declared.key} has no admitted product`);
    const terrain = product.source.terrain;
    if (terrain === null) throw new Error(`Required ground ${declared.key}: its product declares no terrain collider`);
    const collider = await product.assets.read(terrain.collider);
    const assets = new Map([[terrain.collider, collider]]);
    if (terrain.sampling !== undefined && terrain.sampling.file !== terrain.collider) assets.set(terrain.sampling.file, await product.assets.read(terrain.sampling.file));
    // Required manifest metadata applies its datum once, after admitting these raw native queries.
    const ground = clientGround({ ...product.source, meshCollision: null }, assets, 0);
    return { seed: product.source.identity.seed, heightAt: ground.heightAt, normalAt: ground.normalAt, splatAt: ground.splatAt };
  });
}

/** The product a standalone page will admit for `slug` before its hybrid boot runs (its level's terrain step comes first):
 *  only for the selected level of a first-party trusted hybrid this page enters as its shardfile (keyed by its slug). */
function standaloneHybrid(key: string): Promise<RuntimeProduct> | null {
  const manifest = findShard(key);
  if (manifest?.gridShardfile === undefined || manifest.trustedRuntime === undefined || selectedLevel()?.id !== key || shardEntry(manifest) !== 'shardfile') return null;
  return firstPartyDescriptor(key).then(runtimeProduct);
}

/**
 * The game session's baked-samples reader (E434: `startSession` installs it beside `installProductGround`). A level's
 * optional bake (`loadBakedTerrain`, keyed by its baked id) whose shard declares query-only terrain (`terrain.form: 'query'`,
 * its native lattice re-encoded without resampling, G384) is that product's sampling file, read once through the shard's
 * product reader: a grid cell's admitted bytes, or standalone, ahead of the hybrid boot, the canonical product (its descriptor
 * shared with that boot, the file cached for its admission). It is sampled under its own law, epsilon and datum, so the page
 * never downloads the same lattice as `terrain.bin` too. Any other key keeps the engine's fetch. Returns the restore.
 */
export function installProductSampling(): () => void {
  return installBakedSamplesReader((key) => {
    const resident = slugRuntimeProduct(key.key), pending = resident === null ? standaloneHybrid(key.key) : Promise.resolve(resident);
    return pending === null ? null : pending.then(async (product) => {
      const terrain = product.source.terrain;
      if (terrain === null || terrain.form !== 'query') return null;
      const profile = terrain.sampling, wire = await product.assets.read(profile.file);
      return { seed: product.source.identity.seed, ...bilinearTerrainSamplers(decodeTerrainTile(wire), profile.normalEpsilon, profile.datum) };
    });
  });
}
