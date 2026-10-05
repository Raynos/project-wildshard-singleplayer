#!/usr/bin/env node
// SF6b: called only by the serialized pusher; builders leave generated parts alone.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { linkNodeModules } from './link-node-modules.mjs';
import { GENERATED_FILES, generatedIncreases, generatedPart, increaseTrailers, replaceDebt, verifyIncreaseTrailers } from './generated-policy.mjs';

const text = (root, args, input, env = process.env) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, input, env }).trim();
/** Materialize committed input only, with each workspace link pointing inside this export. */
export function committedExport(root, sha, target) {
  const archive = resolve(target, 'source.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, sha, '--', '.', ':!art', ':!progress', ':!sources', ':!drafts', ':!ios', ':!android', ':!.claude'], { cwd: root });
  execFileSync('tar', ['-xf', archive, '-C', target]);
  rmSync(archive);
  linkNodeModules(root, target);
  if (existsSync(resolve(target, 'scripts/gen.mjs'))) execFileSync(process.execPath, ['scripts/gen.mjs'], { cwd: target, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}
const measurement = (root, sha) => ({
  edges: JSON.parse(text(root, ['show', `${sha}:lint/layer-edges.json`])).edges,
  ratchet: JSON.parse(text(root, ['show', `${sha}:lint/ratchet.json`])),
});
/** Retry a moved source tip without merging generated blobs or claiming any shared WIP. */
/** A generated output's committed text at `sha`, or null when the output is new (not in that commit yet). */
function committedText(root, sha, file) {
  const listed = execFileSync('git', ['ls-tree', '--name-only', sha, '--', file], { cwd: root, encoding: 'utf8' }).trim();
  return listed === '' ? null : execFileSync('git', ['show', `${sha}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
export async function regenerateCommitted(root, approvalFile) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const base = text(root, ['rev-parse', 'HEAD']);
    const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-generated-')));
    try {
      committedExport(root, base, scratch);
      const { generatedFiles } = await import(pathToFileURL(resolve(scratch, 'scripts/generated-files.mjs')).href);
      const candidate = generatedFiles(scratch), increases = generatedIncreases(measurement(root, base), candidate.measurement);
      let trailers = '';
      if (increases.length > 0) {
        if (!approvalFile) throw new Error(`Coordinator approval required; save this exact receipt to an approval file and use GENERATED_APPROVAL_FILE:\n${JSON.stringify({ approver: 'wildshard-new', increases }, null, 2)}`);
        const approval = JSON.parse(readFileSync(resolve(approvalFile), 'utf8'));
        trailers = increaseTrailers(approval.increases, approval.approver);
        verifyIncreaseTrailers(increases, trailers);
      }
      const changed = Object.entries(candidate.outputs).filter(([file, content]) => committedText(root, base, file) !== content);
      if (text(root, ['rev-parse', 'HEAD']) !== base) continue;
      if (changed.length === 0) { console.log(`generated-files: ${base.slice(0, 9)} already current`); return base; }
      const index = resolve(scratch, 'index'), env = { ...process.env, GIT_INDEX_FILE: index, WILDSHARD_GENERATED_SOURCE: base };
      text(root, ['read-tree', base], undefined, env);
      for (const [file, content] of changed) text(root, ['update-index', '--add', '--cacheinfo', `100644,${text(root, ['hash-object', '-w', '--stdin'], content)},${file}`], undefined, env);
      if (existsSync(resolve(root, '.githooks/pre-commit'))) {
        const hook = spawnSync(resolve(root, '.githooks/pre-commit'), [], { cwd: root, env, encoding: 'utf8' });
        if (hook.error) throw hook.error;
        if (hook.status !== 0) {
          if (text(root, ['rev-parse', 'HEAD']) !== base) continue;
          throw new Error(`Generated pre-commit failed: ${hook.stderr.length > 0 ? hook.stderr : hook.stdout}`);
        }
      }
      const message = `SHARD-PLATFORM SF6b: regenerate committed outputs at the serialized push (E435)\n\nGenerated-Source: ${base}\n${trailers}\n\nCo-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>\nPlan-State: unchanged\n`;
      const messageFile = resolve(scratch, 'message'); writeFileSync(messageFile, message);
      if (existsSync(resolve(root, '.githooks/commit-msg'))) execFileSync(resolve(root, '.githooks/commit-msg'), [messageFile], { cwd: root, env, stdio: 'inherit' });
      const sha = text(root, ['commit-tree', text(root, ['write-tree'], undefined, env), '-p', base], message, env);
      const result = spawnSync('git', ['update-ref', 'refs/heads/main', sha, base], { cwd: root, encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status !== 0) { if (text(root, ['rev-parse', 'HEAD']) !== base) continue; throw new Error(result.stderr); }
      // Preserve independently staged changes and every foreign working hunk. Only advance untouched copies.
      for (const [file, content] of changed) {
        const fresh = committedText(root, base, file) === null; // a newly generated output (no copy in the base yet)
        const old = fresh ? '' : text(root, ['rev-parse', `${base}:${file}`]);
        let staged;
        try { staged = text(root, ['rev-parse', `:${file}`]); } catch { staged = ''; }
        if (fresh) {
          // a new output: put the committed blob in the shared index too, or HEAD's new file would show as a staged deletion
          for (let retry = 0; retry < 20; retry++) {
            const added = spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${text(root, ['rev-parse', `${sha}:${file}`])},${file}`], { cwd: root, encoding: 'utf8' });
            if (added.error) throw added.error;
            if (added.status === 0) break;
            if (!added.stderr.includes('index.lock') || retry === 19) throw new Error(added.stderr);
            await sleep(100);
          }
        } else if (staged === old) {
          for (let retry = 0; retry < 20; retry++) {
            if (text(root, ['rev-parse', `:${file}`]) !== old) { staged = ''; break; }
            const aligned = spawnSync('git', ['update-index', '--cacheinfo', `100644,${text(root, ['rev-parse', `${sha}:${file}`])},${file}`], { cwd: root, encoding: 'utf8' });
            if (aligned.error) throw aligned.error;
            if (aligned.status === 0) break;
            if (!aligned.stderr.includes('index.lock') || retry === 19) throw new Error(aligned.stderr);
            await sleep(100);
          }
        }
        const disk = resolve(root, file);
        const original = committedText(root, base, file);
        if (fresh ? !existsSync(disk) : staged === old && existsSync(disk) && readFileSync(disk, 'utf8') === original) writeFileSync(disk, content);
        else console.warn(`generated-files: preserved working edits in ${file}; committed output is current`);
      }
      console.log(`generated-files: committed ${sha} from ${base} (${changed.length} outputs)`);
      return sha;
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  }
  throw new Error('Generated regeneration source changed 12 times; retry after the source commit burst settles');
}
/** Check the complete committed docs/inputs before the Vercel filter removes documentation. */
export async function checkCommitted(root, sha) {
  const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-generated-check-')));
  try {
    committedExport(root, sha, scratch);
    const { checkGenerated } = await import(pathToFileURL(resolve(scratch, 'scripts/generated-files.mjs')).href);
    const parent = text(root, ['rev-parse', `${sha}^`]), message = text(root, ['show', '-s', '--format=%B', sha]);
    const changed = text(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(Boolean);
    const generatedChanged = changed.filter((file) => GENERATED_FILES.includes(file) && generatedPart(file, committedText(root, parent, file) ?? '') !== generatedPart(file, committedText(root, sha, file) ?? ''));
    if (generatedChanged.length > 0 && !message.split('\n').includes(`Generated-Source: ${parent}`)) throw new Error('Generated edits require a serialized regeneration commit naming its exact source parent');
    if (message.split('\n').some((line) => line.startsWith('Generated-Source: '))) {
      if (!message.split('\n').includes(`Generated-Source: ${parent}`) || changed.some((file) => !GENERATED_FILES.includes(file))) throw new Error('Regeneration commit may only touch generated outputs of its exact parent');
      if (!isDeepStrictEqual(replaceDebt(measurement(root, parent).ratchet, {}), replaceDebt(measurement(root, sha).ratchet, {}))) throw new Error('Regeneration cannot modify ratchet policy inputs');
      const beforeDoc = text(root, ['show', `${parent}:docs/ENGINE.md`]), afterDoc = text(root, ['show', `${sha}:docs/ENGINE.md`]);
      const manual = (doc) => doc.replace(generatedPart('docs/ENGINE.md', doc), '');
      if (manual(beforeDoc) !== manual(afterDoc)) throw new Error('Regeneration cannot modify manual ENGINE prose');
    }
    checkGenerated(scratch, measurement(root, parent), message);
    console.log(`generated-files: ${sha.slice(0, 9)} committed outputs and exact increase receipts passed`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    await (process.argv[2] === '--check'
      ? checkCommitted(root, process.argv[3] ?? text(root, ['rev-parse', 'HEAD']))
      : regenerateCommitted(root, process.env.GENERATED_APPROVAL_FILE));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
