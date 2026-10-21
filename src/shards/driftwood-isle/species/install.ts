import { crabShell } from './crab';
import { productHullBook } from '@wildshard/game/looks/speciesBook';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Page looks read admitted rows; the packed owner binds the original joints and lift. */
export async function driftwoodLooks(product: ShardProduct): Promise<readonly SpeciesLook[]> {
  const looks = productHullBook(product).packed.looks(await product.json('look/creature-looks.json'));
  return [{ ...looks.get('crab'), damageMul: crabShell }, looks.get('monkey'), looks.get('sailor'), looks.get('captain')];
}
