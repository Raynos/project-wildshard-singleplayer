import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/** Any defining engine/game validator change invalidates durable verdicts, including parser and memory policy. */
export function shardfileValidationRevision(root = resolve(import.meta.dirname, '..')) {
  const hash = createHash('sha256');
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:ts|json)$/u.test(entry.name) && !entry.name.includes('.generated.')) hash.update(relative(root, path)).update('\0').update(readFileSync(path)).update('\0');
    }
  };
  visit(resolve(root, 'src/engine')); visit(resolve(root, 'src/game'));
  return hash.digest('hex');
}
