import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import courseSource from '@wildshard/commons/scripts/course.as?raw';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseDecisionScripts } from '@wildshard/sdk/decisionScripts';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { kokparModuleOptions, nalatiKokparRows, NALATI_KOKPAR_MODULE, NALATI_COURSE_MODULE, type NalatiKokpar } from './kokparRows';

const PREFIX = '/src/shards/nalati-grasslands/';
const decode = new TextDecoder('utf-8', { fatal: true }), encode = new TextEncoder();
/** GR6: the kokpar round and course compiled in the build (G783) from every declared behaviour source, cached under the
 *  author program; the round module ships as a product blob. */
export async function nalatiKokparProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles' | 'compileDecisionRows'>): Promise<{ rows: NalatiKokpar; blob: NamedBlob; courseBlob: NamedBlob }> {
  const compile = ctx.compileDecisionRows, list = ctx.inputFiles;
  if (compile === undefined || list === undefined) throw new Error('Nalati kokpar needs decision-row compilation and its input inventory');
  const inputs = list([`${PREFIX}behaviour/`]).filter(url => url.endsWith('.as'));
  const files = await ctx.cached({ id: 'kokpar-course-files', inputs }, async read => {
    const authored = new Map([...read].map(([url, bytes]): [string, string] => [url.slice(PREFIX.length), decode.decode(bytes)]));
    const built = await nalatiKokparRows(compile, authored, courseSource);
    return new Map([['kokpar.json', encode.encode(JSON.stringify(built.rows))], ['kokpar.wasm', built.wasm], ['course.wasm', built.courseWasm]]);
  });
  const document = files.get('kokpar.json'), wasm = files.get('kokpar.wasm'), courseWasm = files.get('course.wasm');
  if (files.size !== 3 || document === undefined || wasm === undefined || courseWasm === undefined) throw new Error('Nalati kokpar cache inventory differs');
  const rows = nalatiKokparWire(decode.decode(document));
  if (rows.compiled.source !== NALATI_KOKPAR_MODULE || rows.program.script.module !== `blobs/wasm/${hashImmutableBytes(wasm)}.wasm` || rows.compiled.bytes !== wasm.byteLength
    || rows.course.script.module !== `blobs/wasm/${hashImmutableBytes(courseWasm)}.wasm` || rows.compiled.courseBytes !== courseWasm.byteLength) throw new Error('Kokpar executable identity differs');
  return { rows, blob: nameBlob(NALATI_KOKPAR_MODULE, 'wasm', wasm, kokparModuleOptions()), courseBlob: nameBlob(NALATI_COURSE_MODULE, 'wasm', courseWasm, { critical: true, script: { abi: 1, pages: rows.course.script.pages } }) };
}
function object(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function point(value: unknown): value is { x: number; z: number } {
  return object(value, ['x', 'z']) && typeof value['x'] === 'number' && Number.isFinite(value['x'])
    && typeof value['z'] === 'number' && Number.isFinite(value['z']);
}
function messages(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'string');
}
/** Admit the closed cached envelope and both executable contracts on every loan. */
export function nalatiKokparWire(text: string): NalatiKokpar {
  const input: unknown = JSON.parse(text);
  if (!object(input, ['program', 'compiled', 'course', 'home', 'goals', 'messages'])) throw new Error('Invalid cached kokpar fields');
  const program = input['program'], courseProgram = input['course'], compiled = input['compiled'], home = input['home'], goals = input['goals'], notices = input['messages'];
  if (!object(program, ['script', 'bytes']) || program['bytes'] !== '' || !object(courseProgram, ['script', 'bytes']) || courseProgram['bytes'] !== ''
    || !object(compiled, ['source', 'bytes', 'courseBytes']) || compiled['source'] !== NALATI_KOKPAR_MODULE
    || typeof compiled['bytes'] !== 'number' || !Number.isSafeInteger(compiled['bytes']) || compiled['bytes'] < 1
    || typeof compiled['courseBytes'] !== 'number' || !Number.isSafeInteger(compiled['courseBytes']) || compiled['courseBytes'] < 1
    || !point(home) || !Array.isArray(goals) || !goals.every(point) || !messages(notices)) throw new Error('Invalid cached kokpar rows');
  const scripts = parseDecisionScripts([program['script'], courseProgram['script']]);
  const round = scripts[0], course = scripts[1];
  if (round === undefined || course === undefined || round.id !== 'nalati.kokpar' || course.id !== 'practice.course') throw new Error('Invalid cached kokpar scripts');
  return { program: { script: round, bytes: '' }, compiled: { source: compiled['source'], bytes: compiled['bytes'], courseBytes: compiled['courseBytes'] },
    course: { script: course, bytes: '' }, home, goals, messages: notices };
}
