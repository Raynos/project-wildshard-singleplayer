import { nalatiNativeProgram } from './nalati-native-program';
import * as v from 'valibot';
import { nalatiKokparWire } from '../../src/shards/nalati-grasslands/generators/kokparProgram';
import type { NalatiKokpar } from '../../src/shards/nalati-grasslands/generators/kokparRows';

/** GR6: Nalati's kokpar round and course rows and round module bytes, as the product builds them (kokparRows.ts),
 *  compiled once in a plain Node child (`nalati-kokpar-compile.mjs`); the retired job's generated files no longer exist. */
const compiled = v.parse(v.object({ rows: v.unknown(), wasm: v.string(), courseWasm: v.string() }), JSON.parse(await nalatiNativeProgram('kokpar')));
export const NALATI_CURRENT_KOKPAR: NalatiKokpar = nalatiKokparWire(JSON.stringify(compiled.rows));
const { courseBytes: _courseBytes, ...originalCompiled } = NALATI_CURRENT_KOKPAR.compiled;
const raw = v.parse(v.object({ program: v.object({ script: v.unknown() }), course: v.object({ script: v.unknown() }) }), compiled.rows);

/** The compiler appends sourceHash after admission. Re-admission moves that key;
 * restore only its original position, requiring every compiler field and value
 * to match the complete raw row before using it in a predecessor wire oracle. */
export function predecessorKokparScript(input: unknown, current: NalatiKokpar['program']['script']): NalatiKokpar['program']['script'] {
  const before = v.parse(v.record(v.string(), v.unknown()), input), { sourceHash, ...body } = current;
  if (sourceHash === undefined) throw new Error('Missing original compiler provenance');
  const restored = { ...body, sourceHash };
  if (JSON.stringify(restored) !== JSON.stringify(before)) throw new Error('Original compiler metadata or order differs');
  return restored;
}
/** Independent predecessor envelope for every retained complete legacy byte/cost oracle. */
export const NALATI_KOKPAR: NalatiKokpar = { ...NALATI_CURRENT_KOKPAR,
  program: { ...NALATI_CURRENT_KOKPAR.program, script: predecessorKokparScript(raw.program.script, NALATI_CURRENT_KOKPAR.program.script) },
  compiled: originalCompiled, course: { script: predecessorKokparScript(raw.course.script, NALATI_CURRENT_KOKPAR.course.script), bytes: compiled.courseWasm } };
export const NALATI_COURSE_WASM: Uint8Array = new Uint8Array(Buffer.from(compiled.courseWasm, 'base64'));
export const NALATI_KOKPAR_WASM: Uint8Array = new Uint8Array(Buffer.from(compiled.wasm, 'base64'));
