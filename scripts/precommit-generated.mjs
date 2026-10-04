#!/usr/bin/env node
// Builders commit source; only the serialized clean-export runner commits generated parts.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { GENERATED_FILES, builderGeneratedChanges, generatedPart, replaceDebt } from './generated-policy.mjs';

/** Check Git's current (including pathspec/private) index rather than another builder's disk files. */
export function precommitGenerated(root = resolve(import.meta.dirname, '..')) {
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const paths = git(['diff', '--cached', '--name-only', '--no-renames']).split('\n').filter(Boolean);
  const head = git(['rev-parse', 'HEAD']);
  const read = (ref, file) => { try { return execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch { return ''; } };
  const changed = builderGeneratedChanges(paths, (file) => read(head, file), (file) => read('', file));
  if (changed.length === 0) return;
  if (process.env.WILDSHARD_GENERATED_SOURCE !== head) throw new Error(`Builders commit source only; leave generated parts to scripts/push-main.sh: ${changed.join(', ')}`);
  if (paths.some((file) => !GENERATED_FILES.includes(file))) throw new Error('Regeneration may only commit generated outputs');
  for (const file of paths) {
    const before = read(head, file), after = read('', file);
    if (file === 'lint/ratchet.json' && !isDeepStrictEqual(replaceDebt(JSON.parse(before), {}), replaceDebt(JSON.parse(after), {}))) throw new Error('Regeneration cannot modify ratchet policy');
    if (file === 'docs/ENGINE.md' && before.replace(generatedPart(file, before), '') !== after.replace(generatedPart(file, after), '')) throw new Error('Regeneration cannot modify manual ENGINE prose');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { precommitGenerated(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
