import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
      if (!/^src\/shards\/[^/]+\//u.test(path)
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
