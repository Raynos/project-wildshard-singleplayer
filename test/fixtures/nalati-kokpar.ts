// oxlint-disable-next-line import/no-nodejs-modules -- The compiler runs in plain Node, outside the test's happy-dom.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { nalatiKokparWire } from '../../src/shards/nalati-grasslands/generators/kokparProgram';
import type { NalatiKokpar } from '../../src/shards/nalati-grasslands/generators/kokparRows';

/** GR6: Nalati's kokpar round and course rows and round module bytes, as the product builds them (kokparRows.ts),
 *  compiled once in a plain Node child (`nalati-kokpar-compile.mjs`); the retired job's generated files no longer exist. */
const compiled = v.parse(v.object({ rows: v.unknown(), wasm: v.string(), courseWasm: v.string() }), JSON.parse(execFileSync(process.execPath,
  ['--import', './scripts/bake-loader.mjs', 'test/fixtures/nalati-kokpar-compile.mjs'], { encoding: 'utf8', maxBuffer: 1 << 26 })));
export const NALATI_CURRENT_KOKPAR: NalatiKokpar = nalatiKokparWire(JSON.stringify(compiled.rows));
const { courseBytes: _courseBytes, ...originalCompiled } = NALATI_CURRENT_KOKPAR.compiled;
/** Independent predecessor envelope for every retained complete legacy byte/cost oracle. */
export const NALATI_KOKPAR: NalatiKokpar = { ...NALATI_CURRENT_KOKPAR, compiled: originalCompiled,
  course: { ...NALATI_CURRENT_KOKPAR.course, bytes: compiled.courseWasm } };
export const NALATI_COURSE_WASM: Uint8Array = new Uint8Array(Buffer.from(compiled.courseWasm, 'base64'));
export const NALATI_KOKPAR_WASM: Uint8Array = new Uint8Array(Buffer.from(compiled.wasm, 'base64'));
