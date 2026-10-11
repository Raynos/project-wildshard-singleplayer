// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI accepts filesystem project/output paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The author proof tape is an explicit local input file.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { AuthorProofPlanSchema } from './tickProtocol';
import { buildProject, newProject, projectAssets, readProjectAssets, validateProject } from './project';
import { parseShardfile, ShardfileSchema, type Shardfile } from './shardfile';
import { devProject } from './dev';
import { proveAuthorSimulation, measureSimulation, validateSimulation } from './headless';
import { performanceReport, performanceReportLines, type PerformanceObservations } from './reportCard';
import { projectPerformancePolicy } from './performancePolicy';
import { readShardfileSource } from './sourceReader';
import { assetOverdraw } from './assets';
// oxlint-disable-next-line import/no-nodejs-modules -- The CLI releases its author server on termination.
import process from 'node:process';
import { buildBehaviourProject } from './buildBehaviour';
import { synthProject } from './synth';
import { formatJsonSchemas, schemaAt, schemaDeclaration } from './formatJsonSchema';

const unmeasured: PerformanceObservations = { scripts: { p95Micros: 0, maxMicros: 0, samples: 0 }, fuel: { p95: 0, max: 0, samples: 0 } };
function printReport(shard: Shardfile, observed: PerformanceObservations, policy: 'warn' | 'refuse'): void {
  const report = performanceReport(shard, observed, policy);
  for (const line of performanceReportLines(report)) console.info(line);
  if (observed.scripts.samples > 0) console.info('script CPU estimate: 60 warm-up ticks; minimum p95 of three 60-tick windows; raw maxima and all fuel retained');
  if (!report.pass) throw new Error('Performance report refused this shard');
}
async function admitBuild(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, policy: 'warn' | 'refuse'): Promise<void> {
  // Native hybrids need their trusted recipes for a meaningful proof; never invent a fake native measurement.
  if (shard.runtime !== null) { printReport(shard, unmeasured, policy); return; }
  printReport(shard, await measureSimulation(shard, assets), policy);
}
/** Run the author CLI; returns only after validation/build completes. */
export async function runCli(args: readonly string[]): Promise<void> {
  const [command, input, output, buildFlag] = args;
  if (command === 'schema') {
    if (buildFlag !== undefined) throw new Error('usage: wildshard schema [list|shardfile|root] [JSON-pointer]');
    if (input === undefined || input === 'list') {
      if (output !== undefined) throw new Error('schema list accepts no pointer');
      console.info(JSON.stringify(['shardfile', ...Object.keys(formatJsonSchemas())], null, 2)); return;
    }
    const document = input === 'shardfile' ? schemaDeclaration(ShardfileSchema) : formatJsonSchemas()[input];
    if (document === undefined) throw new Error(`Unknown schema root: ${input}`);
    // Whole root sections accept their authored spelling; deeper paths retain RFC 6901 semantics.
    const pointer = input === 'shardfile' && output !== undefined && /^\/[a-z][A-Za-z0-9]*$/u.test(output)
      ? `/properties${output}` : output;
    console.info(JSON.stringify(schemaAt(document, pointer), null, 2)); return;
  }
  if (input === undefined) throw new Error('usage: wildshard new <project> | synth <project> | build <project> [output] [--product-only] | build <project> --behaviour-only | validate <project|shard.json> | dev <project> [port]');
  if (command === 'synth') {
    if (output !== undefined) throw new Error('usage: wildshard synth <project>');
    const result = await synthProject(resolve(input));
    console.info(`synthesized ${result.path} (${result.hash})`); return;
  }
  if (command === 'new') { newProject(resolve(input), input.split('/').reverse().find((part) => part !== '') ?? ''); return; }
  if (command === 'dev') {
    const port = output === undefined ? 0 : Number(output);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('dev port must be 0..65535');
    const server = await devProject(resolve(input), { port });
    const close = (): void => { void server.close(); }; process.once('SIGINT', close); process.once('SIGTERM', close);
    console.info(`wildshard dev: ${server.url}`); return;
  }
  if (command === 'build') {
    if (output === '--behaviour-only' && (buildFlag === undefined || buildFlag === '--check')) {
      const files = await buildBehaviourProject(resolve(input), { check: buildFlag === '--check' });
      console.info(`built ${files.length} native behaviour outputs`); return;
    }
    if (buildFlag !== undefined && buildFlag !== '--product-only') throw new Error('unknown build flag');
    const shard = await buildProject(resolve(input), output === undefined ? undefined : resolve(output), { ...(buildFlag === '--product-only' ? { client: null } : {}), admit: admitBuild }); console.info(`built ${shard.identity.slug} v${shard.version}`); return;
  }
  if (command === 'prove') {
    if (output === undefined || buildFlag !== undefined) throw new Error('usage: wildshard prove <project|shard.json> <proof.json>');
    const authored = input.endsWith('.json') ? undefined : await readProjectAssets(resolve(input));
    const shard = authored?.shard ?? parseShardfile(readShardfileSource(input));
    const assets = authored?.assets ?? projectAssets(resolve(input, '..'), shard, 'product');
    const plan = v.parse(AuthorProofPlanSchema, JSON.parse(readFileSync(resolve(output), 'utf8')));
    console.info(JSON.stringify(await proveAuthorSimulation(shard, assets, plan), null, 2)); return;
  }
  if (command === 'validate') {
    const built = input.endsWith('.json');
    const authored = built ? undefined : await readProjectAssets(resolve(input));
    const shard = authored?.shard ?? parseShardfile(readShardfileSource(input));
    const assets = authored?.assets ?? projectAssets(resolve(input, '..'), shard, 'product');
    const project = built ? resolve(input, '..') : resolve(input), policy = projectPerformancePolicy(project, shard);
    validateProject(shard, assets, project);
    let layers = 0, blended = 0, masked = 0;
    const kinds = new Map(shard.files.map((file) => [file.hash, file.kind]));
    for (const [hash, bytes] of assets) {
      const kind = kinds.get(hash) ?? 'commons';
      const estimate = assetOverdraw(kind, bytes); layers += estimate.layers; blended += estimate.blendedLayers; masked += estimate.maskedLayers;
    }
    console.info(`advisory asset raster layers: ${layers.toFixed(2)} total, ${blended.toFixed(2)} blended, ${masked.toFixed(2)} alpha-tested (primitive bounds; before culling/occlusion, not measured screen overdraw)`);
    if (shard.runtime !== null) { printReport(shard, unmeasured, policy); console.info(`validated ${shard.identity.slug} v${shard.version}: native execution/entries UNMEASURED (trusted browser proof required)`); return; }
    const proof = await validateSimulation(shard, assets);
    printReport(shard, proof, policy);
    console.info(`validated ${shard.identity.slug} v${shard.version}: ${proof.ticks} sim ticks, ${proof.lanes} edge lanes, ${proof.steps} capsule steps`);
    console.info(`advisory tick timing (${proof.timing.samples} samples): median ${proof.timing.medianMicros.toFixed(1)} us, max ${proof.timing.maxMicros.toFixed(1)} us, declared ${shard.serverBudget.tickMicros} us`);
    if (proof.timing.medianMicros > shard.serverBudget.tickMicros) console.warn('advisory: measured tick median exceeds the declared runtime budget; host load is not an admission refusal');
    return;
  }
  throw new Error('unknown wildshard command');
}
