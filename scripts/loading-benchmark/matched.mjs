import { spawn } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = arg('out');
if (!output) throw new Error('Requires --out, --before, --before-pin, --after and --after-pin');
const root = fileURLToPath(new URL('../../', import.meta.url));
const before = { base: arg('before'), pin: arg('before-pin'), out: resolvePath(output, 'before') };
const after = { base: arg('after'), pin: arg('after-pin'), out: resolvePath(output, 'after') };
for (const arm of [before, after]) if (!arm.base || !/^[a-f0-9]{40}$/u.test(arm.pin ?? '')) throw new Error('Both arms need a URL and exact commit');
const shards = ['driftwood-isle', 'nalati-grasslands', '_template', 'pine-hollow'];
for (const [index, shard] of shards.entries()) for (const arm of index % 2 ? [after, before] : [before, after]) {
  console.log('MATCHED', arm.pin, shard, new Date().toISOString());
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`${root}/scripts/loading-benchmark/capture.mjs`, `--base=${arm.base}`, `--pin=${arm.pin}`, `--out=${arm.out}`, `--shards=${shard}`, '--cpu=4'], { stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`capture exit ${code}`)));
  });
}
