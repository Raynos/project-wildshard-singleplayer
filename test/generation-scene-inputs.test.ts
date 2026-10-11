// oxlint-disable-next-line import/no-nodejs-modules -- Check the retained producer's declared source closure.
import { existsSync, readFileSync, statSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve authoring imports within the checkout.
import { dirname, posix } from 'node:path';
import { parseSync } from 'vite';
import { expect, it } from 'vitest';

it('stages every relative SDK dependency of the retained portal-floor producer', () => {
  const input: unknown = JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8'));
  if (input === null || typeof input !== 'object' || !('jobs' in input) || !Array.isArray(input.jobs)) throw new Error('Missing generation jobs');
  const job: unknown = input.jobs.find((row: unknown) => row !== null && typeof row === 'object' && 'id' in row && row.id === 'nine-portal-floors');
  if (job === null || typeof job !== 'object' || !('inputRoots' in job) || !Array.isArray(job.inputRoots)) throw new Error('Missing portal-floor inputs');
  const roots = job.inputRoots.filter((root: unknown): root is string => typeof root === 'string');
  const queue = roots.filter(root => root.startsWith('src/sdk/') && root.endsWith('.ts'));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    for (const node of parseSync(file, readFileSync(file, 'utf8')).program.body) {
      if (node.type !== 'ImportDeclaration' || typeof node.source.value !== 'string' || !node.source.value.startsWith('.')) continue;
      const path = posix.normalize(posix.join(dirname(file), node.source.value));
      const target = [path, `${path}.ts`].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      if (target === undefined) throw new Error(`Unresolved authoring import: ${file} -> ${path}`);
      expect(roots.some(root => root === target || target.startsWith(`${root}/`)), `${file} -> ${target}`).toBe(true);
      if (target.endsWith('.ts')) queue.push(target);
    }
  }
});
