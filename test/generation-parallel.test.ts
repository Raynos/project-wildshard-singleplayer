// oxlint-disable-next-line import/no-nodejs-modules -- Real producer fixtures own these files and subprocess handshakes.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture-owned source and control paths.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures remain outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Admission pins the real producer's exact bytes.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { prepareGeneration } from '../scripts/generate.mjs';

it('runs independent producers together and waits for declared output dependencies', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'generation-parallel-')));
  const put = (file: string, text: string): void => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
  const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
  try {
    put('package.json', '{"name":"parallel-fixture"}');
    const jobs = ['alpha', 'beta', 'gamma'].map(id => {
      const entry = `src/shards/${id}/generators/bake-${id}.mjs`, output = `src/shards/${id}/data/${id}.generated.json`;
      const expected = JSON.stringify(id === 'gamma' ? 'alpha' : id);
      const peer = id === 'alpha' ? 'beta' : 'alpha';
      const control = join(root, 'control');
      const source = `import{existsSync,mkdirSync,readFileSync,writeFileSync}from'node:fs';
${id === 'gamma' ? '' : `mkdirSync(${JSON.stringify(control)},{recursive:true});writeFileSync(${JSON.stringify(join(control, id))},'started');
const deadline=Date.now()+1500;while(!existsSync(${JSON.stringify(join(control, peer))})){if(Date.now()>deadline)throw Error('Independent producer never started');await new Promise(done=>setTimeout(done,5));}`}
mkdirSync(${JSON.stringify(dirname(output))},{recursive:true});
writeFileSync(${JSON.stringify(output)},${id === 'gamma' ? "readFileSync('src/shards/alpha/data/alpha.generated.json')" : JSON.stringify(expected)});`;
      put(entry, source);
      return { id, shard: id, entry, command: [entry], inputRoots: ['package.json', entry, ...(id === 'gamma' ? ['src/shards/alpha/data/alpha.generated.json'] : [])], outputs: [output], platform: 'portable', buildOutputs: { [output]: hash(expected) } };
    });
    put('scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT: parallel fixture', jobs }));
    await prepareGeneration(root, { concurrency: 4, cacheDir: join(root, 'cache') });
    for (const job of jobs) expect(readFileSync(join(root, job.outputs[0] ?? ''), 'utf8')).toBe(JSON.stringify(job.id === 'gamma' ? 'alpha' : job.id));
    await expect(prepareGeneration(root, { concurrency: 0 })).rejects.toThrow('Generation concurrency');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
