// oxlint-disable-next-line import/no-nodejs-modules -- Seal a tiny candidate index independently from loose peer bytes.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture inputs and cleanup remain under repository tmp.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The override consumes absolute Vite module identifiers.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { stagedInputOverride } from '../scripts/precommit-related.mjs';
import { stagedFiles } from '../scripts/precommit-projects.mjs';

test('raw workflow imports read candidate YAML instead of loose peer edits', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/staged-yaml-'));
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env: environment, stdio: 'ignore' }); };
  try {
    git('init', '-q'); git('config', 'user.name', 'fixture'); git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'core.hooksPath', '/dev/null');
    for (const file of ['workflow.yml', 'workflow.yaml']) writeFileSync(resolve(root, file), 'jobs: original\n');
    git('add', '.'); git('commit', '-qm', 'original workflow');
    const candidate = 'jobs:\n  exact: {}\n';
    for (const file of ['workflow.yml', 'workflow.yaml']) writeFileSync(resolve(root, file), candidate);
    git('add', '.');
    for (const file of ['workflow.yml', 'workflow.yaml']) writeFileSync(resolve(root, file), 'jobs: loose-peer\n');
    const override = stagedInputOverride(root, stagedFiles(root));
    if (typeof override.load !== 'function') throw new Error('Missing candidate load hook');
    for (const file of ['workflow.yml', 'workflow.yaml']) {
      const loaded: unknown = await Reflect.apply(override.load, {}, [`${resolve(root, file)}?raw`]);
      expect(loaded).toBe(`export default ${JSON.stringify(candidate)};`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
