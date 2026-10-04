// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI accepts filesystem project/output paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Validate a built JSON product from disk.
import { readFileSync } from 'node:fs';
import { buildProject, newProject, projectAssets, readProject, validateProject } from './project';
import { parseShardfile } from './shardfile';

/** Run the author CLI; returns only after validation/build completes. */
export async function runCli(args: readonly string[]): Promise<void> {
  const [command, input, output] = args;
  if (input === undefined) throw new Error('usage: wildshard new <project> | build <project> [output] | validate <project|shard.json>');
  if (command === 'new') { newProject(resolve(input), input.split('/').reverse().find((part) => part !== '') ?? ''); return; }
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
