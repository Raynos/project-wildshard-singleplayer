import { originalSpeciesJson } from './nalati-original-species';
import * as v from 'valibot';
import { nalatiProductRows } from '../../src/shards/nalati-grasslands/generators/product';
const species = v.parse(v.object({
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string(),
    v2: v.object({ artifact: v.object({ pages: v.number() }) }) }),
  compiled: v.object({ bytes: v.number() }),
  witnessBytes: v.number(),
}), originalSpeciesJson('species.json'));
const source: ReturnType<typeof nalatiProductRows> = nalatiProductRows(species, {
  program: species.program, stealthProgram: species.program,
  compiledBytes: species.compiled.bytes, projectionPages: species.program.v2.artifact.pages,
});
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only fixtures borrow the same full admitted header.
export default source;
