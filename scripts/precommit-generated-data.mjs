import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Supply immutable JSON build outputs to a source-only guard export, without running a producer.
 * The exported (staged) catalogue pins the bytes; working source and unpinned outputs never participate.
 * Missing pinned outputs refuse before lint can misclassify an unresolved type as renderer reach.
 * @param {string} root Working repository with locally generated outputs.
 * @param {string} snapshot Immutable staged-tree export containing its generation catalogue.
 * @param {string} [blobDirectory] Commit-produced, content-addressed bytes; each is verified against the staged pin.
 */
export function materializeGuardData(root, snapshot, blobDirectory) {
  const catalog = resolve(snapshot, 'scripts/generation-jobs.json');
  if (!existsSync(catalog)) return;
  /** @type {{jobs: {id?: string, buildOutputs?: Record<string, string>}[]}} */
  const staged = JSON.parse(readFileSync(catalog, 'utf8'));
  for (const job of staged.jobs) {
    for (const [path, hash] of Object.entries(job.buildOutputs ?? {})) {
      if (!path.endsWith('.json')) continue; // Executable modules must always come from the staged Git tree.
      if (!/^src\/shards\/[^/]+\//u.test(path)
        || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')
        || !/^[a-f0-9]{64}$/u.test(hash)) throw new Error(`Invalid generated guard data: ${path}`);
      const target = resolve(snapshot, path), source = resolve(root, path);
      if (existsSync(target)) continue;
      const blob = blobDirectory === undefined ? undefined : resolve(blobDirectory, hash);
      const available = blob !== undefined && existsSync(blob) ? blob : source;
      if (!existsSync(available)) throw new Error(`Missing pinned generated guard data: ${path} (job ${job.id ?? 'unnamed'}). Run pnpm gen before measuring source guards.`);
      const bytes = readFileSync(available);
      if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Generated guard data does not match staged hash: ${path}`);
      JSON.parse(bytes.toString('utf8')); // A pinned file cannot masquerade as executable source.
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
  }
}

/** Publish inert generated JSON only after checking every staged catalogue pin.
 * Executable outputs never enter the early guard transport; this grants no verdict.
 * @param {string} snapshot Exact staged export after initial generation.
 * @param {string} blobDirectory Content-addressed commit guard transport.
 */
export function publishGuardData(snapshot, blobDirectory) {
  const catalogue = resolve(snapshot, 'scripts/generation-jobs.json');
  if (!existsSync(catalogue)) return;
  /** @type {{jobs: {buildOutputs?: Record<string, string>}[]}} */
  const staged = JSON.parse(readFileSync(catalogue, 'utf8'));
  const verified = [];
  for (const job of staged.jobs) for (const [path, hash] of Object.entries(job.buildOutputs ?? {})) {
    if (!path.endsWith('.json')) continue;
    if (!/^src\/shards\/[^/]+\//u.test(path)
      || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')
      || !/^[a-f0-9]{64}$/u.test(hash)) throw new Error(`Invalid generated guard data: ${path}`);
    const bytes = readFileSync(resolve(snapshot, path));
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Generated guard data does not match staged hash: ${path}`);
    JSON.parse(bytes.toString('utf8'));
    verified.push({hash, bytes});
  }
  mkdirSync(blobDirectory, {recursive:true});
  for (const {hash, bytes} of verified) {
    const target = resolve(blobDirectory, hash), temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, bytes);
    renameSync(temporary, target);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [root, snapshot] = process.argv.slice(2);
    if (!root || !snapshot || process.argv.length !== 4) throw new Error('Usage: precommit-generated-data.mjs <root> <snapshot>');
    materializeGuardData(resolve(root), resolve(snapshot));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
