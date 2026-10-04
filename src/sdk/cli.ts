// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI accepts filesystem project/output paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Validate a built JSON product from disk.
import { readFileSync } from 'node:fs';
import { buildProject, newProject, projectAssets, readProject, validateProject } from './project';
import { parseShardfile } from './shardfile';
import { devProject } from './dev';
// oxlint-disable-next-line import/no-nodejs-modules -- The CLI releases its author server on termination.
import process from 'node:process';

/** Run the author CLI; returns only after validation/build completes. */
export async function runCli(args: readonly string[]): Promise<void> {
  const [command, input, output] = args;
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
    const shard = await buildProject(resolve(input), output === undefined ? undefined : resolve(output)); console.info(`built ${shard.identity.slug} v${shard.version}`); return;
  }
  if (command === 'validate') {
    const built = input.endsWith('.json'); const shard = built ? parseShardfile(JSON.parse(readFileSync(input, 'utf8'))) : await readProject(resolve(input));
    const assets = built ? new Map([...shard.files.map((f) => [f.hash, readFileSync(resolve(input, '..', f.hash))] as const), ...shard.requires.commons.map((h) => [`commons:${h}`, readFileSync(resolve(input, '..', h))] as const)]) : projectAssets(resolve(input), shard);
    validateProject(shard, assets); console.info(`validated ${shard.identity.slug} v${shard.version}`); return;
  }
  throw new Error('unknown wildshard command');
}
