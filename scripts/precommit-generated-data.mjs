import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Supply immutable JSON build outputs to a source-only guard export, without running a producer.
 * The exported (staged) catalogue pins the bytes; working source and unpinned outputs never participate.
 * Missing outputs remain missing so the existing dependency guard refuses unresolved imports.
 * @param {string} root Working repository with locally generated outputs.
 * @param {string} snapshot Immutable staged-tree export containing its generation catalogue.
 */
export function materializeGuardData(root, snapshot) {
  const catalog = resolve(snapshot, 'scripts/generation-jobs.json');
  if (!existsSync(catalog)) return;
  /** @type {{jobs: {buildOutputs?: Record<string, string>}[]}} */
  const staged = JSON.parse(readFileSync(catalog, 'utf8'));
  for (const job of staged.jobs) {
    for (const [path, hash] of Object.entries(job.buildOutputs ?? {})) {
      if (!path.endsWith('.json')) continue; // Executable modules must always come from the staged Git tree.
      if (!/^src\/shards\/[^/]+\/(?:data|assets)\//u.test(path)
        || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')
        || !/^[a-f0-9]{64}$/u.test(hash)) throw new Error(`Invalid generated guard data: ${path}`);
      const target = resolve(snapshot, path), source = resolve(root, path);
      if (existsSync(target) || !existsSync(source)) continue;
      const bytes = readFileSync(source);
      if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Generated guard data does not match staged hash: ${path}`);
      JSON.parse(bytes.toString('utf8')); // A pinned file cannot masquerade as executable source.
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
  }
}
