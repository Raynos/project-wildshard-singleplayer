// GR6: compile Nalati's five view modules in plain Node (a happy-dom test environment cannot feed the compiler's
// WebAssembly streaming) and print them as one JSON line: { "<id>": "<base64 wasm>" }.
import { readFileSync } from 'node:fs';
import { compileScriptV2 } from '../../src/sdk/bake/compileScriptV2.ts';
import { NALATI_VIEW_MODULES } from '../../src/shards/nalati-grasslands/generators/viewPrograms.ts';

const out = {};
for (const row of NALATI_VIEW_MODULES) {
  const source = readFileSync(new URL(`../../src/shards/nalati-grasslands/${row.source}`, import.meta.url), 'utf8');
  const bytes = await compileScriptV2(source, { lane: 'view', ioBytes: row.ioBytes, ...(row.pages > 1 ? { maximumPages: row.pages } : {}) });
  out[row.id] = Buffer.from(bytes).toString('base64');
}
process.stdout.write(`${JSON.stringify(out)}\n`);
