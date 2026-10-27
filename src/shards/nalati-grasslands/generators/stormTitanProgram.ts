import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiTitanRows, type NalatiTitanModule, type NalatiTitanPrograms } from './stormTitanRows.mjs';

/** The Storm Titan and pasture programs' rows and both selected modules' bytes and witnesses. */
export interface NalatiTitan { readonly programs: NalatiTitanPrograms; readonly titan: NalatiTitanModule; readonly pasture: NalatiTitanModule }

const PREFIX = '/src/shards/nalati-grasslands/';
const decode = new TextDecoder('utf-8', { fatal: true }), encode = new TextEncoder();
const FILES = ['titan.json', 'titan.wasm', 'titan-witness.bin', 'pasture.wasm', 'pasture-witness.bin'];
/** GR6 (G783): the Storm Titan fight and the shared pasture programme compiled in the build from every declared
 *  behaviour source, cached under the author program, in place of the retired `nalati-storm-titan` job. */
export async function nalatiTitanProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles' | 'compileReturnProjection'>): Promise<NalatiTitan> {
  const compile = ctx.compileReturnProjection, list = ctx.inputFiles;
  if (compile === undefined || list === undefined) throw new Error('Nalati Storm Titan needs return-projection compilation and its input inventory');
  const inputs = list([`${PREFIX}behaviour/`]).filter(url => url.endsWith('.as'));
  const files = await ctx.cached({ id: 'titan-program', inputs }, async read => {
    const authored = new Map([...read].map(([url, bytes]): [string, string] => [url.slice(PREFIX.length), decode.decode(bytes)]));
    const built = await nalatiTitanRows(compile, authored);
    return new Map([['titan.json', encode.encode(JSON.stringify(built.programs))], ['titan.wasm', built.titan.wasm], ['titan-witness.bin', built.titan.witness],
      ['pasture.wasm', built.pasture.wasm], ['pasture-witness.bin', built.pasture.witness]]);
  });
  const [document, titanWasm, titanWitness, pastureWasm, pastureWitness] = FILES.map(name => files.get(name));
  if (files.size !== FILES.length || document === undefined || titanWasm === undefined || titanWitness === undefined || pastureWasm === undefined || pastureWitness === undefined)
    throw new Error('Nalati Storm Titan cache inventory differs');
  return { programs: nalatiTitanWire(decode.decode(document)), titan: { wasm: titanWasm, witness: titanWitness }, pasture: { wasm: pastureWasm, witness: pastureWitness } };
}

/** Read the titan rows back from their JSON (this module's cache envelope, or a test's compiled copy). */
export function nalatiTitanWire(text: string): NalatiTitanPrograms {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || !('attack' in value) || !('wind' in value) || !('compiled' in value)) throw new Error('Invalid cached Nalati Storm Titan rows');
  // the envelope is written from the builder's NalatiTitanPrograms and read back unchanged
  return value as NalatiTitanPrograms;
}
