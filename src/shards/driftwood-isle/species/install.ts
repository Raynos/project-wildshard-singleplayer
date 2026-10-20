import { CRAB_LOOK } from './crab';
import { CAPTAIN_LOOK } from './captain';
import { CREATURE_BODIES } from './bodies';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Page looks read admitted rows; the packed owner binds the original joints and lift. */
export async function driftwoodLooks(product: ShardProduct): Promise<readonly SpeciesLook[]> {
  const looks = CREATURE_BODIES.looks(await product.json('look/creature-looks.json'));
  return [CRAB_LOOK, looks.get('monkey'), looks.get('sailor'), CAPTAIN_LOOK];
}
