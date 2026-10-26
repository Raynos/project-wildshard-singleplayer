// oxlint-disable-next-line import/no-nodejs-modules -- Admit the complete original species cost input for existing declaration-only oracles.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { nalatiProductRows } from '../../src/shards/nalati-grasslands/generators/product';
const species = v.parse(v.object({
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string() }),
  witnessBytes: v.number(),
}), JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json', 'utf8')));
const source: ReturnType<typeof nalatiProductRows> = nalatiProductRows(species);
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only fixtures borrow the same full admitted header.
export default source;
