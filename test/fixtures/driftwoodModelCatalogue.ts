// oxlint-disable-next-line import/no-nodejs-modules -- The fixture reads two bake outputs the catalogue rows still carry.
import { readFileSync } from 'node:fs';
import trailCatalogue from '../../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };
import { entryDeckSpecimen } from '../../src/shards/driftwood-isle/generators/entryDeckSpecimen';
import { siteCatalogue } from '../../src/shards/driftwood-isle/generators/siteCatalogue';
import { driftwoodSceneBanks } from './driftwoodSceneBanks';

/** Driftwood's pre-admission model rows, as the retired specimen-catalogue job wrote them (boot/modelCatalogue.generated
 *  .json, GR7): the trail and entry-deck specimens, the site catalogue, the rock copies and the foliage and pier facts. */
export async function driftwoodModelCatalogue(): Promise<Readonly<Record<string, unknown>>> {
  const banks = await driftwoodSceneBanks();
  const facts = (name: string): unknown => {
    const rows: unknown = JSON.parse(readFileSync(`src/shards/driftwood-isle/data/${name}.json`, 'utf8'));
    return typeof rows === 'object' && rows !== null && 'facts' in rows ? rows.facts : undefined;
  };
  return { catalogue: [...trailCatalogue, entryDeckSpecimen()], siteCatalogue: siteCatalogue(banks), rockWorld: banks.rocks.world,
    foliage: facts('foliageScenes.generated'), piers: facts('pierScenes.generated') };
}
