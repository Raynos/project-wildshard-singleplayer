// GR6: compile Nalati's Storm Titan and pasture programmes in plain Node (a happy-dom test environment cannot feed the
// compiler) through the product's own builder, and print { programs, titan, pasture } (bytes base64) as one JSON line.
import { readDecisionSources } from '../../src/sharddev/buildDecisionScripts.ts';
import { compileReturnProjectionV2 } from '../../src/sharddev/returnProjectionV2.ts';
import { memoAssemblyScript } from '../../src/sharddev/bake/assemblyscriptMemo.ts';
import { nalatiTitanRows } from '../../src/shards/nalati-grasslands/generators/stormTitanRows.mjs';

const { programs, titan, pasture } = await nalatiTitanRows((input, registries, authored, options) =>
  compileReturnProjectionV2(input, registries, authored, { ...options, compileMemo: memoAssemblyScript }), readDecisionSources('src/shards/nalati-grasslands'));
const base64 = bytes => Buffer.from(bytes).toString('base64');
process.stdout.write(`${JSON.stringify({ programs, titan: { wasm: base64(titan.wasm), witness: base64(titan.witness) }, pasture: { wasm: base64(pasture.wasm), witness: base64(pasture.witness) } })}\n`);
