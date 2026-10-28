import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { authorFormatRows, defineNamedRows } from '@wildshard/sdk/formatJsonSchema';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { nalatiSpeciesProgram } from './speciesProgram.ts';

const text = { kind: 'string' }, number = { kind: 'number' }, opaque = { kind: 'unknown' };
const parts = { kind: 'array', item: { kind: 'array', item: number } };
const inputSchema = defineNamedRows({ kind: 'object', mode: 'strip', entries: {
  body: { kind: 'object', mode: 'strip', entries: { bytes: number, bodies: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: {
    key: text, bones: { kind: 'array', item: { kind: 'object', mode: 'loose', entries: { name: text } } },
    dims: opaque, fur: parts, hard: parts, eye: parts,
  } } } } },
  admission: { kind: 'object', mode: 'loose', entries: { script: { kind: 'record', key: text, value: opaque }, bytes: text,
    compiled: { kind: 'exact-optional', item: opaque }, v2: { kind: 'exact-optional', item: opaque } } },
  strike: opaque, kingPose: { kind: 'object', mode: 'strip', entries: { programs: opaque, group: text } },
} });
const outputSchema = defineNamedRows({ kind: 'object', mode: 'loose', entries: {
  program: { kind: 'object', mode: 'loose', entries: { script: opaque, bytes: text } },
  compiled: { kind: 'object', mode: 'strip', entries: { source: text, bytes: number, hash: text } },
} });

/** Construct from explicitly declared source loans; this retained witness has no publication or implicit file access.
 * @param {(url: URL) => Uint8Array} readSource */
export async function nalatiSpeciesSource(readSource) {
  const files = await nalatiSpeciesProgram({ compileDecisionRows: compileDecisionScripts, compileReturnProjection: compileReturnProjectionV2, cached: (step, make) => {
    const inputs = new Map(step.inputs?.map(name => [name, Uint8Array.from(readSource(
      new URL(name.startsWith('/') ? `../../../../public${name}` : `../${name}`, import.meta.url)))]));
    return Promise.resolve(make(inputs));
  } }, input => {
    if (!inputSchema.accepts(input)) throw new Error('Invalid species CLI source metadata');
    return input;
  }, input => authorFormatRows('speciesBookRows.CreatureGuestSchema', input), hash => `/assets/nalati/baked/bodies-${hash}.bin`);
  const metadata = files.get('species.json');
  if (metadata === undefined) throw new Error('Missing source species metadata');
  const species = JSON.parse(new TextDecoder().decode(metadata));
  if (!outputSchema.accepts(species)) throw new Error('Missing source-owned held program');
  return { files, program: species.program, compiled: species.compiled };
}
