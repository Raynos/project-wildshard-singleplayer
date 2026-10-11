// oxlint-disable-next-line import/no-nodejs-modules -- Author build fixtures own temporary project files.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary author projects remain outside the shared source tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine each fixture's paths to its temporary project.
import { dirname, join } from 'node:path';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import { BehaviourBuildSchema, buildBehaviourProject } from '@wildshard/sdk/buildBehaviour';
import { runCli } from '../src/sdk/cli';

it.each(['driftwood-isle', 'nalati-grasslands', 'pine-hollow'])('wildshard build regenerates %s native director outputs byte-for-byte', async slug => {
  const root = mkdtempSync(join(tmpdir(), 'native-behaviour-build-'));
  const project = `src/shards/${slug}`;
  try {
    const descriptor = v.parse(BehaviourBuildSchema, JSON.parse(readFileSync(`${project}/behaviour/build.json`, 'utf8')));
    const inputs = new Set(['behaviour/build.json', ...descriptor.modules.flatMap(row => [row.source, ...row.bindings, ...(row.director === undefined ? [] : [row.director])])]);
    for (const path of inputs) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(`${project}/${path}`, join(root, path));
    }
    await runCli(['build', root, '--behaviour-only']);
    await runCli(['build', root, '--behaviour-only', '--check']);
    for (const row of descriptor.modules) {
      for (const path of [...row.bindings, ...row.embedded.map(output => output.file)]) {
        expect(readFileSync(join(root, path))).toEqual(readFileSync(`${project}/${path}`));
      }
      const binding = row.bindings[0];
      if (binding === undefined) throw new Error('Native director fixture requires its binding');
      const data = v.parse(v.object({ module: v.string() }), JSON.parse(readFileSync(join(root, binding), 'utf8')));
      const output = join(root, row.assets, data.module);
      expect(readFileSync(output)).toEqual(readFileSync(`${project}/${row.assets}/${data.module}`));
      writeFileSync(output, 'stale');
      await expect(runCli(['build', root, '--behaviour-only', '--check'])).rejects.toThrow('output is stale');
      expect(readFileSync(output, 'utf8')).toBe('stale');
      // Restore only this generated fixture output so the next module's stale check reaches it.
      copyFileSync(`${project}/${row.assets}/${data.module}`, output);
    }
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
    const row = { director: 'data/director.json', source: 'behaviour/director.as', maximumPages: 1, assets: 'assets', bindings: ['data/director.json'], embedded: [] };
    writeFileSync(join(project, 'data/director.json'), '{"module":"unchanged"}');
    writeFileSync(join(project, 'behaviour/build.json'), JSON.stringify({ version: 1, modules: [row] }));
    await expect(buildBehaviourProject(project)).rejects.toThrow('outside project');
    expect(readFileSync(join(project, 'data/director.json'), 'utf8')).toBe('{"module":"unchanged"}');
    writeFileSync(join(root, 'behaviour/director.as'), source);
    const binding = readFileSync('src/shards/pine-hollow/data/director.json', 'utf8');
    writeFileSync(join(root, 'data/director.json'), binding);
    writeFileSync(join(root, 'behaviour/build.json'), JSON.stringify({ version: 1, modules: [{ ...row, bindings: ['data/director.json', 'data/director.json'] }] }));
    await expect(buildBehaviourProject(root)).rejects.toThrow('duplicate output');
    expect(readFileSync(join(root, 'data/director.json'), 'utf8')).toBe(binding);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);
