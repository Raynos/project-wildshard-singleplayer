// oxlint-disable-next-line import/no-nodejs-modules -- Fake repositories and exports are owned by this fixture.
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture uses a disposable canonical directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fake package paths never touch the shared workspace.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual package resolution in the isolated export.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the fixture with the current Node executable.
import process from 'node:process';
import { expect, it } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

it('links new workspace manifest dependencies to the export and repairs them on rerun', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'export-workspace-'))), repo = join(root, 'repo'), tree = join(root, 'tree');
  function put(path: string, value: object): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value)); }
  try {
    mkdirSync(join(repo, 'node_modules/.pnpm'), { recursive: true });
    mkdirSync(join(repo, 'src/sdk/node_modules'), { recursive: true });
    put(join(tree, 'src/sdk/package.json'), { name: '@wildshard/sdk', dependencies: {} });
    put(join(tree, 'src/format/package.json'), { name: '@wildshard/format', version: '0.0.0' });
    linkNodeModules(repo, tree);
    expect(existsSync(join(tree, 'src/sdk/node_modules/@wildshard/format'))).toBe(false);
    put(join(tree, 'src/sdk/package.json'), { name: '@wildshard/sdk', dependencies: { '@wildshard/format': 'workspace:*' } });
    linkNodeModules(repo, tree);
    expect(realpathSync(join(tree, 'src/sdk/node_modules/@wildshard/format'))).toBe(join(tree, 'src/format'));
    linkNodeModules(repo, tree);
    expect(realpathSync(join(tree, 'src/sdk/node_modules/@wildshard/format'))).toBe(join(tree, 'src/format'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('repairs root links when commons arrives after the export was linked', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'export-late-commons-'))), repo = join(root, 'repo'), tree = join(root, 'tree');
  function put(path: string, value: string): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
  try {
    mkdirSync(join(repo, 'node_modules/.pnpm'), { recursive: true });
    put(join(tree, 'src/sdk/package.json'), JSON.stringify({ name: '@wildshard/sdk', type: 'module' }));
    linkNodeModules(repo, tree);
    const manifest = JSON.stringify({ name: '@wildshard/commons', type: 'module', exports: { './bake/portableMath': './bake/portableMath.mjs' } });
    put(join(repo, 'src/commons/package.json'), manifest);
    put(join(repo, 'src/commons/bake/portableMath.mjs'), "export const owner = 'foreign-working-source';");
    put(join(tree, 'src/commons/package.json'), manifest);
    put(join(tree, 'src/commons/bake/portableMath.mjs'), "export const owner = 'committed-export';");
    linkNodeModules(repo, tree);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import {owner} from '@wildshard/commons/bake/portableMath'; console.log(owner);"], { cwd: tree, encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout.trim()).toBe('committed-export');
    expect(realpathSync(join(tree, 'node_modules/@wildshard/commons'))).toBe(join(tree, 'src/commons'));
    linkNodeModules(repo, tree);
    expect(realpathSync(join(tree, 'node_modules/@wildshard/commons'))).toBe(join(tree, 'src/commons'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
