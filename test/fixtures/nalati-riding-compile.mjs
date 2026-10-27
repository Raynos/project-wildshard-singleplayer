// GR6: compile Nalati's mounts / taming / riding program in plain Node (a happy-dom test environment cannot feed the
// compiler) through the product's own builder, and print { programs, wasm, witness } (base64) as one JSON line.
import { readFileSync } from 'node:fs';
import { compileReturnProjectionV2 } from '../../src/sdk/returnProjectionV2.ts';
import { nalatiRidingRows } from '../../src/shards/nalati-grasslands/generators/ridingRows.mjs';
import { NALATI_ECOLOGY as ecology } from '../../src/shards/nalati-grasslands/generators/ecology.mjs';

const root = 'src/shards/nalati-grasslands/';
const { programs, wasm, witness } = await nalatiRidingRows(compileReturnProjectionV2, source => readFileSync(`${root}${source}`, 'utf8'), ecology);
process.stdout.write(`${JSON.stringify({ programs, wasm: Buffer.from(wasm).toString('base64'), witness: Buffer.from(witness).toString('base64') })}\n`);
