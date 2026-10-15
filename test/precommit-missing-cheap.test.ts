// oxlint-disable-next-line import/no-nodejs-modules -- A tiny author fixture exercises the real generator without copying the repository.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Only the small fixture uses temporary storage.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay inside its owned root.
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { prepareMissingCheapInputs } from '../scripts/precommit-inputs.mjs';

test('a warm mirror fills missing cheap outputs in catalogue order and retains real producer failures', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'precommit-cheap-')));
  const put = (file: string, bytes: string): void => { writeFileSync(join(root, file), bytes); };
  const entry = 'scripts/bake-cheap.mjs', consumer = 'scripts/bake-consumer.mjs', pinned = 'scripts/bake-retained.mjs';
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'src/shards'), { recursive: true });
    put(entry, "import{writeFileSync}from'node:fs';writeFileSync('first.json','42');writeFileSync('second.json','43');");
    put(consumer, "import{readFileSync,writeFileSync}from'node:fs';writeFileSync('consumer.json',readFileSync('first.json'));");
    put(pinned, "throw Error('a retained producer must not run');");
    const jobs = [
      { id: 'cheap', entry, outputs: ['first.json', 'second.json'], buildTimeOutputs: ['first.json', 'second.json'], inputRoots: [entry] },
      { id: 'consumer', entry: consumer, outputs: ['consumer.json'], buildTimeOutputs: ['consumer.json'], inputRoots: [consumer, 'first.json'] },
      { id: 'retained', entry: pinned, outputs: ['retained.json'], inputRoots: [pinned], buildOutputs: { 'retained.json': '0'.repeat(64) } },
    ];
    const declared = [];
    for (const job of jobs) declared.push({ ...job, shard: null, command: [job.entry], platform: 'portable' });
    put('scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT', jobs: declared }));
    await prepareMissingCheapInputs(root);
    expect(readFileSync(join(root, 'consumer.json'), 'utf8')).toBe('42');
    expect(readFileSync(join(root, 'second.json'), 'utf8')).toBe('43');
    expect(existsSync(join(root, 'retained.json'))).toBe(false);
    put(entry, "throw Error('missing cheap producer failed');");
    await prepareMissingCheapInputs(root); // Present outputs skip the producer even when its source changed.
    rmSync(join(root, 'second.json'));
    await expect(prepareMissingCheapInputs(root)).rejects.toThrow();
    expect(existsSync(join(root, 'second.json'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
