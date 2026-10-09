#!/usr/bin/env node
// SF6b: called only by the serialized pusher; builders leave generated parts alone.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { linkNodeModules } from './link-node-modules.mjs';
import { GENERATED_FILES, generatedIncreases, generatedPart, increaseTrailers, replaceDebt, verifyIncreaseTrailers } from './generated-policy.mjs';
import { isWitnessManifest, manifestOutcome } from './witness-manifests.mjs';
import { bakeOutcome, isRecordedBake } from './bake-input-hashes.mjs';

const text = (root, args, input, env = process.env) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, input, env }).trim();
/**
 * Stamp a regeneration commit this process built and verified, so the push gate need not repeat the same clean export
 * and check (process audit 2026-10-09: the gate's duplicate `generated` step cost 57-107 s per push). Only commits
 * made here are stamped; a builder tip reported "already current" is still checked by the gate.
 */
export function verifiedStamp(root, sha) {
  return resolve(text(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']), 'generated-verified', sha);
}
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
/**
 * The rows of `increases` the coordinator's approval covers: each exactly listed row, plus every row a standing rule
 * covers (`standing: [{ kind: 'graph', key: '<RegExp source>' }]`, e.g. a shard's downward imports; wildshard-new,
 * SF74 W14). A standing rule saves re-writing an exact receipt each time a lane's count moves again (811 → 813 → 816
 * on 2026-10-09). Rows it does not cover stay out, so verifyIncreaseTrailers still refuses them and names them; the
 * commit's trailers always list the exact measured rows.
 */
export function approvedIncreases(approval, increases) {
  const exact = new Set((Array.isArray(approval.increases) ? approval.increases : []).map((row) => JSON.stringify(row, Object.keys(row).sort())));
  const standing = (Array.isArray(approval.standing) ? approval.standing : []).map((rule) => ({ kind: rule.kind, key: new RegExp(rule.key, 'u') }));
  return increases.filter((row) => exact.has(JSON.stringify(row, Object.keys(row).sort())) || standing.some((rule) => rule.kind === row.kind && rule.key.test(row.key)));
}
/** Retry a moved source tip without merging generated blobs or claiming any shared WIP. */
/** A generated output's committed text at `sha`, or null when the output is new (not in that commit yet). */
function committedText(root, sha, file) {
  const listed = execFileSync('git', ['ls-tree', '--name-only', sha, '--', file], { cwd: root, encoding: 'utf8' }).trim();
  return listed === '' ? null : execFileSync('git', ['show', `${sha}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
/**
 * Re-record the export's stale witness manifests in a child process, beside the synchronous generators (a commit
 * without scripts/witness-manifests.mjs has none). Rejects, naming each shard and payload, when a payload changed.
 */
async function refreshWitnessManifests(root, scratch) {
  const script = resolve(scratch, 'scripts/witness-manifests.mjs'), result = resolve(scratch, 'witness-manifests.result.json');
  if (!existsSync(script)) return {};
  const cache = resolve(text(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']), 'witness-verified');
  const child = spawn(process.execPath, [script, '--refresh', scratch, cache, result], { cwd: scratch, stdio: ['ignore', 'inherit', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(stderr.trim() || `witness-manifests exited ${String(code)}`);
  return JSON.parse(readFileSync(result, 'utf8'));
}
/**
 * Re-record the input hashes of the export's recorded bakes (scripts/bake-input-hashes.mjs, SF74 W22) in a child process
 * with the TS loader, beside the generators. Rejects, naming the bake, when more than its input hashes changed.
 */
async function refreshRecordedBakes(scratch) {
  const script = resolve(scratch, 'scripts/bake-input-hashes.mjs'), result = resolve(scratch, 'bake-input-hashes.result.json');
  if (!existsSync(script) || !existsSync(resolve(scratch, 'scripts/bake-loader.mjs'))) return {};
  const child = spawn(process.execPath, ['--import', './scripts/bake-loader.mjs', script, '--refresh', scratch, result], { cwd: scratch, stdio: ['ignore', 'inherit', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(stderr.trim() || `bake-input-hashes exited ${String(code)}`);
  return JSON.parse(readFileSync(result, 'utf8'));
}
export async function regenerateCommitted(root, approvalFile) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const base = text(root, ['rev-parse', 'HEAD']);
    const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-generated-')));
    let witnesses = Promise.resolve({});
    try {
      committedExport(root, base, scratch);
      witnesses = Promise.all([refreshWitnessManifests(root, scratch), refreshRecordedBakes(scratch)]).then(([manifests, bakes]) => ({ ...manifests, ...bakes }));
      witnesses.catch(() => undefined); // awaited below; never an unhandled rejection while the generators run
      const { generatedFiles } = await import(pathToFileURL(resolve(scratch, 'scripts/generated-files.mjs')).href);
      const candidate = generatedFiles(scratch), increases = generatedIncreases(measurement(root, base), candidate.measurement);
      let trailers = '';
      if (increases.length > 0) {
        if (!approvalFile) throw new Error(`Coordinator approval required; save this exact receipt to an approval file and use GENERATED_APPROVAL_FILE:\n${JSON.stringify({ approver: 'wildshard-new', increases }, null, 2)}`);
        const approval = JSON.parse(readFileSync(resolve(approvalFile), 'utf8'));
        trailers = increaseTrailers(approvedIncreases(approval, increases), approval.approver);
        verifyIncreaseTrailers(increases, trailers);
      }
      let witnessOutputs;
      const waitFrom = performance.now();
      try { witnessOutputs = await witnesses; console.log(`generated-files: witness manifests waited ${((performance.now() - waitFrom) / 1000).toFixed(1)} s after the generators`); } catch (error) { if (text(root, ['rev-parse', 'HEAD']) !== base) continue; throw error; }
      const changed = Object.entries({ ...candidate.outputs, ...witnessOutputs }).filter(([file, content]) => committedText(root, base, file) !== content);
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
      const refreshed = Object.keys(witnessOutputs).map((file) => isRecordedBake(file) ? file : file.split('/')[2]).join(', ');
      const witnessNote = refreshed === '' ? '' : `Witness inputs re-recorded on clean HEAD, payloads byte-identical: ${refreshed}\n\n`;
      const message = `SHARD-PLATFORM SF6b: regenerate committed outputs at the serialized push (E435)\n\n${witnessNote}Generated-Source: ${base}\n${trailers}\n\nCo-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>\n`;
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
      mkdirSync(resolve(verifiedStamp(root, sha), '..'), { recursive: true }); writeFileSync(verifiedStamp(root, sha), `${base}\n`);
      console.log(`generated-files: committed ${sha} from ${base} (${changed.length} outputs)`);
      return sha;
    } finally {
      await witnesses.catch(() => undefined);
      rmSync(scratch, { recursive: true, force: true });
    }
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
      if (!message.split('\n').includes(`Generated-Source: ${parent}`) || changed.some((file) => !GENERATED_FILES.includes(file) && !isWitnessManifest(file) && !isRecordedBake(file))) throw new Error('Regeneration commit may only touch generated outputs of its exact parent');
      for (const file of changed.filter(isWitnessManifest)) {
        const before = committedText(root, parent, file), after = committedText(root, sha, file);
        if (before === null || after === null || manifestOutcome(before) !== manifestOutcome(after)) throw new Error(`Regeneration may only refresh the inputs hash of ${file}, never its payload records`);
      }
      for (const file of changed.filter(isRecordedBake)) {
        const before = committedText(root, parent, file), after = committedText(root, sha, file);
        if (before === null || after === null || bakeOutcome(before) !== bakeOutcome(after)) throw new Error(`Regeneration may only refresh the input hashes of ${file}, never its baked output`);
      }
      if (!isDeepStrictEqual(replaceDebt(measurement(root, parent).ratchet, {}), replaceDebt(measurement(root, sha).ratchet, {}))) throw new Error('Regeneration cannot modify ratchet policy inputs');
    }
    checkGenerated(scratch, measurement(root, parent), message);
    console.log(`generated-files: ${sha.slice(0, 9)} committed outputs and exact increase receipts passed`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    if (process.argv[2] === '--check') await checkCommitted(root, process.argv[3] ?? text(root, ['rev-parse', 'HEAD']));
    else {
      const sha = await regenerateCommitted(root, process.env.GENERATED_APPROVAL_FILE);
      // push-main.sh pushes exactly this SHA, never a main that moved after the regeneration (the 'Ratchet rose: … is
      // clean' and stale-generated reds: a builder commit landing between regeneration and push was gated unregenerated).
      if (process.env.REGEN_SHA_FILE) writeFileSync(process.env.REGEN_SHA_FILE, `${sha}\n`);
    }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
