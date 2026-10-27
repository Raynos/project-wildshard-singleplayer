import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import courseSource from '@wildshard/commons/scripts/course.as?raw';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { kokparModuleOptions, nalatiKokparRows, NALATI_KOKPAR_MODULE, type NalatiKokpar } from './kokparRows';

const PREFIX = '/src/shards/nalati-grasslands/';
const decode = new TextDecoder('utf-8', { fatal: true }), encode = new TextEncoder();
/** GR6: the kokpar round and course compiled in the build (G783) from every declared behaviour source, cached under the
 *  author program; the round module ships as a product blob. */
export async function nalatiKokparProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles' | 'compileDecisionRows'>): Promise<{ rows: NalatiKokpar; blob: NamedBlob }> {
  const compile = ctx.compileDecisionRows, list = ctx.inputFiles;
  if (compile === undefined || list === undefined) throw new Error('Nalati kokpar needs decision-row compilation and its input inventory');
  const inputs = list([`${PREFIX}behaviour/`]).filter(url => url.endsWith('.as'));
  const files = await ctx.cached({ id: 'kokpar-program', inputs }, async read => {
    const authored = new Map([...read].map(([url, bytes]): [string, string] => [url.slice(PREFIX.length), decode.decode(bytes)]));
    const built = await nalatiKokparRows(compile, authored, courseSource);
    return new Map([['kokpar.json', encode.encode(JSON.stringify(built.rows))], ['kokpar.wasm', built.wasm]]);
  });
  const document = files.get('kokpar.json'), wasm = files.get('kokpar.wasm');
  if (files.size !== 2 || document === undefined || wasm === undefined) throw new Error('Nalati kokpar cache inventory differs');
  return { rows: nalatiKokparWire(decode.decode(document)), blob: nameBlob(NALATI_KOKPAR_MODULE, 'wasm', wasm, kokparModuleOptions()) };
}
/** Read the cached rows back (the cache envelope is this module's own JSON). */
export function nalatiKokparWire(text: string): NalatiKokpar {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || !('program' in value) || !('course' in value) || !('messages' in value)) throw new Error('Invalid cached kokpar rows');
  // the envelope is written above from a NalatiKokpar and read back unchanged
  return value as NalatiKokpar;
}
