// GR6: compile Nalati's kokpar round and course in plain Node (a happy-dom test environment cannot feed the compiler)
// through the product's own builder, and print { rows, wasm: base64 } as one JSON line.
import { readFileSync } from 'node:fs';
import { compileDecisionScripts, readDecisionSources } from '../../src/sdk/buildDecisionScripts.ts';
import { nalatiKokparRows } from '../../src/shards/nalati-grasslands/generators/kokparRows.ts';

const course = readFileSync(new URL('../../src/commons/scripts/course.as', import.meta.url), 'utf8');
const { rows, wasm } = await nalatiKokparRows(compileDecisionScripts, readDecisionSources('src/shards/nalati-grasslands'), course);
process.stdout.write(`${JSON.stringify({ rows, wasm: Buffer.from(wasm).toString('base64') })}\n`);
