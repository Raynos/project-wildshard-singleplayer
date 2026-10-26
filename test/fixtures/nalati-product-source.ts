import { originalSpeciesJson } from './nalati-original-species';
import * as v from 'valibot';
import { nalatiProductRows } from '../../src/shards/nalati-grasslands/generators/product';
const species = v.parse(v.object({
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string() }),
  witnessBytes: v.number(),
}), originalSpeciesJson('species.json'));
const source: ReturnType<typeof nalatiProductRows> = nalatiProductRows(species);
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only fixtures borrow the same full admitted header.
export default source;
