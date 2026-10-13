import { speciesBrains } from '../../../src/sdk/speciesBrains';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES, SKY_PAGE_SPECIES, SKY_PAGE_HOMES } from '../../../src/shards/far-reach/data/brains';
import { pushPlayer } from './heldAuthority';
import type { Animal } from '../../../src/engine/entities/AnimalView';
/** Test binder consumes the defining rows; no private species policy survives in the product. */
export function declaredSkyRows() {
  const brains = speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES);
  return { rows: SKY_PAGE_SPECIES.map(kind => {
    const row = SKY_CREATURE_ROWS.find(value => value.kind === kind); if (row === undefined) throw new Error('Missing authored body');
    return { ...row, ...brains.bind(kind, undefined, kind === 'stormRoc' ? undefined : () => SKY_PAGE_HOMES[kind], { shove: pushPlayer }) };
  }), witness: brains.witness, home: (actor: Animal, at: (typeof SKY_PAGE_HOMES)['skyGoat']) => { brains.home(actor.kind, actor, at); } };
}
