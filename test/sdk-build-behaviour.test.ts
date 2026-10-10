// oxlint-disable-next-line import/no-nodejs-modules -- Author build fixtures own temporary project files.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary author projects remain outside the shared source tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine each fixture's paths to its temporary project.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildBehaviourProject } from '@wildshard/sdk/buildBehaviour';
import { runCli } from '../src/sdk/cli';

it.each(['driftwood-isle', 'nalati-grasslands', 'pine-hollow'])('wildshard build regenerates %s native director outputs byte-for-byte', async slug => {
  const root = mkdtempSync(join(tmpdir(), 'native-behaviour-build-'));
  const project = `src/shards/${slug}`;
  try {
    mkdirSync(join(root, 'behaviour')); mkdirSync(join(root, 'data'));
    for (const path of ['behaviour/director.as', 'behaviour/build.json', 'data/director.json']) copyFileSync(`${project}/${path}`, join(root, path));
    await runCli(['build', root, '--behaviour-only']);
    await runCli(['build', root, '--behaviour-only', '--check']);
    expect(readFileSync(join(root, 'data/director.json'))).toEqual(readFileSync(`${project}/data/director.json`));
    const data = JSON.parse(readFileSync(join(root, 'data/director.json'), 'utf8')) as { module: string };
    expect(readFileSync(join(root, 'assets', data.module))).toEqual(readFileSync(`${project}/assets/${data.module}`));
    writeFileSync(join(root, 'assets', data.module), 'stale');
    await expect(runCli(['build', root, '--behaviour-only', '--check'])).rejects.toThrow('output is stale');
    expect(readFileSync(join(root, 'assets', data.module), 'utf8')).toBe('stale');
    if (slug !== 'nalati-grasslands') expect(readFileSync(join(root, 'behaviour/director.json'))).toEqual(readFileSync(`${project}/behaviour/director.json`));
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);

it('refuses escaped source symlinks and duplicate outputs before changing existing bindings', async () => {
  const root = mkdtempSync(join(tmpdir(), 'native-behaviour-refusal-'));
  try {
    mkdirSync(join(root, 'behaviour')); mkdirSync(join(root, 'data'));
    const source = readFileSync('src/shards/pine-hollow/behaviour/director.as');
    writeFileSync(join(root, 'outside.as'), source);
    // The source target is outside the declared project, even though its symlink is inside behaviour/.
    const project = join(root, 'project'); mkdirSync(join(project, 'behaviour'), { recursive: true }); mkdirSync(join(project, 'data'));
    symlinkSync(join(root, 'outside.as'), join(project, 'behaviour/director.as'));
    const row = { source: 'behaviour/director.as', maximumPages: 1, assets: 'assets', bindings: ['data/director.json'], embedded: [] };
    writeFileSync(join(project, 'data/director.json'), '{"module":"unchanged"}');
    writeFileSync(join(project, 'behaviour/build.json'), JSON.stringify({ version: 1, modules: [row] }));
    await expect(buildBehaviourProject(project)).rejects.toThrow('outside project');
    expect(readFileSync(join(project, 'data/director.json'), 'utf8')).toBe('{"module":"unchanged"}');
    writeFileSync(join(root, 'behaviour/director.as'), source);
    writeFileSync(join(root, 'data/director.json'), '{"module":"unchanged"}');
    writeFileSync(join(root, 'behaviour/build.json'), JSON.stringify({ version: 1, modules: [{ ...row, bindings: ['data/director.json', 'data/director.json'] }] }));
    await expect(buildBehaviourProject(root)).rejects.toThrow('duplicate output');
    expect(readFileSync(join(root, 'data/director.json'), 'utf8')).toBe('{"module":"unchanged"}');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);
