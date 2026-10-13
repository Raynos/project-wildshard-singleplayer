import { installRequiredGroundLoader } from '@wildshard/engine/world/bakedTerrainField';
import { clientGround } from './clientGround';
import { admittedRuntimeProduct } from './runtimeProduct';

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
