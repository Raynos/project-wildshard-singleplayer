import queryTerrain from './nalati-query-terrain-original.json' with { type: 'json' };
import { parseShardfileField } from '../../src/sdk/shardfile';
import render from './nalati-render-rows.json' with { type: 'json' };
import { originalSpeciesJson } from './nalati-original-species';
import * as v from 'valibot';
import { nalatiProductRows } from '../../src/shards/nalati-grasslands/generators/product';

const species = v.parse(v.object({
  program: v.object({ script: v.object({ module: v.string(), pages: v.number() }), bytes: v.string(),
    v2: v.object({ artifact: v.object({ pages: v.number() }) }) }),
  compiled: v.object({ bytes: v.number() }),
  witnessBytes: v.number(),
}), originalSpeciesJson('species.json'));
const terrain=parseShardfileField('terrain',queryTerrain.terrain);
if(terrain===null)throw new Error('Missing original Nalati query terrain');
const source: ReturnType<typeof nalatiProductRows> = nalatiProductRows(species, {
  program: species.program, stealthProgram: species.program,
  compiledBytes: species.compiled.bytes, projectionPages: species.program.v2.artifact.pages,
}, render, {terrain,files:parseShardfileField('files',queryTerrain.files),critical:parseShardfileField('critical',queryTerrain.critical)});
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only fixtures borrow the same full admitted header.
export default source;
