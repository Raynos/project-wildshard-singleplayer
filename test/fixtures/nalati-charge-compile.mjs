// GR6: compile Nalati's Qara Batyr charge in plain Node (a happy-dom test environment cannot feed the compiler) through
// the product's own builder, and print { rows, wasm } (bytes base64) as one JSON line.
import { compileDecisionScripts, readDecisionSources } from '../../src/sdk/buildDecisionScripts.ts';
import { nalatiChargeRows } from '../../src/shards/nalati-grasslands/generators/chargeRows.ts';

const { rows, wasm } = await nalatiChargeRows(compileDecisionScripts, readDecisionSources('src/shards/nalati-grasslands'));
process.stdout.write(`${JSON.stringify({ rows, wasm: Buffer.from(wasm).toString('base64') })}\n`);
