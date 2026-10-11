import { sceneInteractionExample } from '../../scripts/docs/authoring/creatures';
import { spearExample } from '../../scripts/docs/authoring/spear';
import { parseShardfile } from '@wildshard/sdk/shardfile';

/** Retained mechanical fixture for the mandatory brief runner: actual fauna, scene-controlled beacon and equipped commons spear. */
export async function mesaProofExample(beaconSource: string) {
  const { shard, assets } = await sceneInteractionExample(beaconSource), spear = spearExample();
  shard.requires = { ...shard.requires, commons: spear.source.requires.commons, commonsWire: spear.source.requires.commonsWire, commonsCosts: spear.source.requires.commonsCosts };
  shard.library = spear.source.library; shard.items = spear.source.items;
  for (const [hash, bytes] of spear.built.assets) assets.set(`commons:${hash}`, bytes);
  for (const [index, spawn] of shard.creatures.spawns.entries()) spawn.at = spawn.species === 'hawk' ? [0, 8, 12] : [index * 2 - 2, 0, 8];
  return { shard: parseShardfile(shard), assets };
}
