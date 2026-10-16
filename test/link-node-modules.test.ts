// oxlint-disable-next-line import/no-nodejs-modules -- Every write is confined to an owned fixture under ./tmp.
import { mkdirSync, mkdtempSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function scratch(): string {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = realpathSync(mkdtempSync(resolve('tmp', 'link-node-modules-')));
  roots.push(root);
  return root;
}

describe('linkNodeModules', () => {
  it('relinks a package dependency whose old store target is gone', () => {
    const root = scratch();
    const repo = join(root, 'repo'), tree = join(root, 'tree');
    const store = join(repo, 'node_modules', '.pnpm', 'valibot@1.6.0', 'node_modules', 'valibot');
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, 'package.json'), '{"name":"valibot","version":"1.6.0"}');
    mkdirSync(join(repo, 'src', 'format', 'node_modules'), { recursive: true });
    for (const dir of [repo, tree]) {
      mkdirSync(join(dir, 'src', 'format'), { recursive: true });
      writeFileSync(join(dir, 'src', 'format', 'package.json'), '{"name":"@wildshard/format","dependencies":{"valibot":"1.6.0"}}');
    }
    // the tree already has a package node_modules whose valibot link points at a version since removed from the store
    mkdirSync(join(tree, 'node_modules'), { recursive: true });
    mkdirSync(join(tree, 'src', 'format', 'node_modules'), { recursive: true });
    symlinkSync(join(repo, 'node_modules', '.pnpm', 'valibot@1.5.0', 'node_modules', 'valibot'), join(tree, 'src', 'format', 'node_modules', 'valibot'));

    linkNodeModules(repo, tree);

    expect(readlinkSync(join(tree, 'src', 'format', 'node_modules', 'valibot'))).toBe(store);
  });
});
