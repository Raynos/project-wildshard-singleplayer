// Operational readers share the same manifest registry as the game and bakers.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { genShards } from './gen-shards.mjs';

export async function readShards(root = resolve(import.meta.dirname, '..')) {
  await import('./bake-loader.mjs');
  genShards(root);
  const { SHARDS } = await import(pathToFileURL(resolve(root, 'src/game/shard/shards.generated.ts')).href);
  return SHARDS;
}
