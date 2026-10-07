#!/usr/bin/env node
// E432: give a clean export of the repo (a `git archive` tree) the checkout's node_modules — every entry linked back to
// the checkout's, except the workspace packages (@wildshard/engine, game, kit), which link to the export's own
// src/<layer>. A plain `ln -s <repo>/node_modules <tree>/node_modules` would resolve @wildshard/* through the checkout's
// links to the checkout's working tree, so the export would build (and gate) whatever is uncommitted there.
//
//   node scripts/link-node-modules.mjs <repo> <tree>          (the shell scripts)
//   import { linkNodeModules } from './link-node-modules.mjs'  (the node ones)
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** the scopes whose packages live in the repo itself (pnpm-workspace.yaml) */
const WORKSPACE_SCOPES = new Set(['@wildshard']);

/**
 * link `<tree>/node_modules` to `<repo>/node_modules`, the workspace packages to the tree's own sources
 * @param {string} repo the checkout whose node_modules is installed
 * @param {string} tree the export (a git archive of some commit)
 */
export function linkNodeModules(repo, tree) {
  if (realpathSync(tree) !== resolve(tree)) {
    // macOS /tmp and /var are symlinks: a package resolved through node_modules (realpath) and a relative import (as
    // spelled) would load the same engine file twice. Export to the canonical path (`pwd -P`, realpathSync).
    throw new Error(`link-node-modules: ${tree} is not its canonical path (${realpathSync(tree)})`);
  }
  const from = resolve(repo, 'node_modules'), to = resolve(tree, 'node_modules');
  if (!existsSync(from)) return; // nothing installed (a test's throwaway repo): the tree resolves no packages, as before
  if (existsSync(to)) {
    if (lstatSync(to).isSymbolicLink()) throw new Error(`link-node-modules: ${to} is a whole-folder link; remove it first`);
    return; // already linked by an earlier run
  }
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (!WORKSPACE_SCOPES.has(name)) { symlinkSync(join(from, name), join(to, name)); continue; }
    mkdirSync(join(to, name));
    for (const pkg of readdirSync(join(from, name))) {
      const link = join(from, name, pkg);
      // the checkout's link points into the checkout (../../src/engine); the export's points at the same path in the tree
      const target = resolve(dirname(link), readlinkSync(link));
      const inRepo = relative(resolve(repo), target);
      if (inRepo.startsWith('..')) throw new Error(`link-node-modules: ${link} points outside the repo (${target})`);
      // relative, as pnpm writes it (../../src/engine): it stays inside whatever tree holds it, even one nested in this
      // export (a test's throwaway repo)
      symlinkSync(relative(join(to, name), join(resolve(tree), inRepo)), join(to, name, pkg));
    }
  }
  linkPackageNodeModules(repo, tree);
}

/**
 * a workspace package's own dependencies (pnpm installs them in `src/<package>/node_modules`, e.g. the SDK's `sharp`):
 * each entry links to the checkout's installed copy, and a workspace package (`@wildshard/*`) to the tree's own sources
 */
function linkPackageNodeModules(repo, tree) {
  const src = resolve(repo, 'src');
  if (!existsSync(src)) return;
  for (const pkg of readdirSync(src)) {
    const from = join(src, pkg, 'node_modules'), to = resolve(tree, 'src', pkg, 'node_modules');
    if (!existsSync(from) || !existsSync(resolve(tree, 'src', pkg)) || existsSync(to)) continue;
    mkdirSync(to);
    const mirror = (fromDir, toDir) => {
      for (const name of readdirSync(fromDir)) {
        if (name === '.bin') continue;
        const entry = join(fromDir, name);
        if (lstatSync(entry).isSymbolicLink()) {
          const target = realpathSync(entry), inSrc = relative(src, target);
          // a workspace package resolves to the tree's copy of the same source; anything else is the installed package
          symlinkSync(inSrc.startsWith('..') ? target : resolve(tree, 'src', inSrc), join(toDir, name));
        } else if (lstatSync(entry).isDirectory()) { mkdirSync(join(toDir, name)); mirror(entry, join(toDir, name)); }
      }
    };
    mirror(from, to);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [repo, tree] = process.argv.slice(2);
  if (!repo || !tree) { console.error('usage: node scripts/link-node-modules.mjs <repo> <tree>'); process.exit(2); }
  linkNodeModules(repo, tree);
}
