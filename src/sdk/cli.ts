// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI accepts filesystem project/output paths.
import { resolve } from 'node:path';
import { buildProject, newProject, projectAssets, readProject, validateProject } from './project';
import { parseShardfile } from './shardfile';
import { devProject } from './dev';
import { validateSimulation } from './headless';
import { readShardfileSource } from './sourceReader';
import { assetOverdraw } from './assets';
// oxlint-disable-next-line import/no-nodejs-modules -- The CLI releases its author server on termination.
import process from 'node:process';

/** Run the author CLI; returns only after validation/build completes. */
export async function runCli(args: readonly string[]): Promise<void> {
  const [command, input, output, buildFlag] = args;
  if (input === undefined) throw new Error('usage: wildshard new <project> | build <project> [output] | validate <project|shard.json> | dev <project> [port]');
  if (command === 'new') { newProject(resolve(input), input.split('/').reverse().find((part) => part !== '') ?? ''); return; }
  if (command === 'dev') {
    const port = output === undefined ? 0 : Number(output);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('dev port must be 0..65535');
    const server = await devProject(resolve(input), { port });
    const close = (): void => { void server.close(); }; process.once('SIGINT', close); process.once('SIGTERM', close);
    console.info(`wildshard dev: ${server.url}`); return;
  }
  if (command === 'build') {
    if (buildFlag !== undefined && buildFlag !== '--product-only') throw new Error('unknown build flag');
    const shard = await buildProject(resolve(input), output === undefined ? undefined : resolve(output), buildFlag === '--product-only' ? { client: null } : {}); console.info(`built ${shard.identity.slug} v${shard.version}`); return;
  }
  if (command === 'validate') {
    const built = input.endsWith('.json'); const shard = built ? parseShardfile(readShardfileSource(input)) : await readProject(resolve(input));
    const assets = built ? projectAssets(resolve(input, '..'), shard, 'product') : projectAssets(resolve(input), shard);
    validateProject(shard, assets);
    let layers = 0, blended = 0, masked = 0;
    const kinds = new Map(shard.files.map((file) => [file.hash, file.kind]));
    for (const [hash, bytes] of assets) {
      const kind = kinds.get(hash) ?? (bytes[0] === 103 ? 'glb' : bytes[0] === 171 ? 'ktx2' : bytes[0] === 82 ? 'audio' : 'binary');
      const estimate = assetOverdraw(kind, bytes); layers += estimate.layers; blended += estimate.blendedLayers; masked += estimate.maskedLayers;
    }
    console.info(`advisory asset raster layers: ${layers.toFixed(2)} total, ${blended.toFixed(2)} blended, ${masked.toFixed(2)} alpha-tested (primitive bounds; before culling/occlusion, not measured screen overdraw)`);
    const proof = await validateSimulation(shard, assets);
    console.info(`validated ${shard.identity.slug} v${shard.version}: ${proof.ticks} sim ticks, ${proof.lanes} edge lanes, ${proof.steps} capsule steps`);
    console.info(`advisory tick timing (${proof.timing.samples} samples): median ${proof.timing.medianMicros.toFixed(1)} us, max ${proof.timing.maxMicros.toFixed(1)} us, declared ${shard.serverBudget.tickMicros} us`);
    if (proof.timing.medianMicros > shard.serverBudget.tickMicros) console.warn('advisory: measured tick median exceeds the declared runtime budget; host load is not an admission refusal');
    return;
  }
  throw new Error('unknown wildshard command');
}
