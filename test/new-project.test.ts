// oxlint-disable-next-line import/no-nodejs-modules -- Own bounded author fixtures under the repository scratch root.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned author and output paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { buildProject } from '@wildshard/sdk/project';
import { validateOutputProduct } from '@wildshard/sdk/outputProduct';
import { writeNewProject } from '../src/sdk/newProject';
import { runCli } from '../src/sdk/cli';
import { checkShardLayout } from '../scripts/check-shards.mjs';
import layout from '../lint/shard-layout.json';

test('new projects build v2 from build-only data without a custom runtime', async () => {
  mkdirSync('tmp', { recursive: true });
  const scratch = mkdtempSync(resolve('tmp', 'template-layout-'));
  try {
    const project = resolve(scratch, 'new-world'), output = resolve(scratch, 'output');
    await runCli(['new', project, 'new-world']);
    expect(readdirSync(project).sort()).toEqual(['README.md', 'assets', 'behaviour', 'data', 'generators', 'shard.config.ts']);
    expect(() => writeNewProject(project, 'new-world')).toThrow('fresh directory');
    expect(checkShardLayout({ 'new-world': ['README.md', 'assets/', 'behaviour/', 'data/', 'generators/', 'shard.config.ts'] }, { ...layout, legacy: {} })).toEqual([]);
    await buildProject(project, output, { client: null, copyRuntime: true });
    const product = validateOutputProduct(output);
    expect(product.index.formatVersion).toBe(2);
    expect(product.index.identity.slug).toBe('new-world');
    expect(product.index.runtime).toBeNull();
    expect(product.index.sections.length).toBeGreaterThan(0);
    expect(existsSync(resolve(output, 'runtime'))).toBe(false);
    expect(readFileSync(resolve(project, 'README.md'), 'utf8')).toContain('runtime/sections.ts');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

