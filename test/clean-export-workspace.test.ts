// oxlint-disable-next-line import/no-nodejs-modules -- Fake repositories and exports are owned by this fixture.
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture uses a disposable canonical directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fake package paths never touch the shared workspace.
import { dirname, join } from 'node:path';
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
