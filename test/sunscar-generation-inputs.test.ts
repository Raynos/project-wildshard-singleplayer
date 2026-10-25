// oxlint-disable-next-line import/no-nodejs-modules -- Inspect declared producer paths in the real source tree.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

const root = cwd();
for (const job of discoverGeneration(root).jobs.filter(row => row.shard === 'sunscar-dunes')) {
  test(`${job.id} stages every shard-owned static input`, () => {
    const closure = auditAuthoringInputs(root, 'sunscar-dunes', job.entry);
    const missing = closure.files.filter(file => (file.startsWith('src/shards/sunscar-dunes/') || file === 'src/commons/bake/portableMath.ts')
      && /\.(?:ts|mjs|json)$/u.test(file) && !job.outputs.includes(file)
      && !job.inputRoots.some(input => file === input || file.startsWith(`${input}/`)));
    if (closure.files.includes('src/commons/bake/portableMath.ts')
      && !job.inputRoots.some(input => input === 'src/commons/package.json' || input === 'src/commons')) missing.push('src/commons/package.json');
    expect(missing).toEqual([]);
  });
}
