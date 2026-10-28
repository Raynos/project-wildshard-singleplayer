import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import * as v from 'valibot';
import { authorFormatSchema } from '@wildshard/sdk/formatJsonSchema';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { nalatiSpeciesProgram } from './speciesProgram.ts';

const CreatureGuestSchema = authorFormatSchema('speciesBookRows.CreatureGuestSchema');

const inputSchema = v.object({
  body: v.object({ bytes: v.number(), bodies: v.array(v.object({ key: v.string(), bones: v.array(v.looseObject({ name: v.string() })),
    dims: v.unknown(), fur: v.array(v.array(v.number())), hard: v.array(v.array(v.number())), eye: v.array(v.array(v.number())) })) }),
  admission: v.looseObject({ script: v.record(v.string(), v.unknown()), bytes: v.string(), compiled: v.optional(v.unknown()), v2: v.optional(v.unknown()) }),
  strike: v.unknown(), kingPose: v.object({ programs: v.unknown(), group: v.string() }),
});

/** Construct from explicitly declared source loans; this retained witness has no publication or implicit file access.
 * @param {(url: URL) => Uint8Array} readSource */
export async function nalatiSpeciesSource(readSource) {
  const files = await nalatiSpeciesProgram({ compileDecisionRows: compileDecisionScripts, compileReturnProjection: compileReturnProjectionV2, cached: (step, make) => {
    const inputs = new Map(step.inputs?.map(name => [name, Uint8Array.from(readSource(
      new URL(name.startsWith('/') ? `../../../../public${name}` : `../${name}`, import.meta.url)))]));
    return Promise.resolve(make(inputs));
  } }, input => {
    if (!v.is(inputSchema, input)) throw new Error('Invalid species CLI source metadata');
    return input;
  }, input => v.parse(CreatureGuestSchema, input), hash => `/assets/nalati/baked/bodies-${hash}.bin`);
  const metadata = files.get('species.json');
  if (metadata === undefined) throw new Error('Missing source species metadata');
  const species = JSON.parse(new TextDecoder().decode(metadata));
  if (!v.is(v.looseObject({ program: v.looseObject({ script: v.unknown(), bytes: v.string() }),
    compiled: v.object({ source: v.string(), bytes: v.number(), hash: v.string() }),
  }), species)) throw new Error('Missing source-owned held program');
  return { files, program: species.program, compiled: species.compiled };
}
