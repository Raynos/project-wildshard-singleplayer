import { expect, test } from 'vitest';
import { packShards,readDurations } from '../scripts/vitest-shard';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual workflow covers every discovered test partition.
import {readdirSync,readFileSync} from 'node:fs';

test('duration partitions retain every file once, including unmeasured files', () => {
  const paths = Array.from({ length: 137 }, (_, i) => `test/fixture-${i}.test.ts`);
  const durations = new Map(paths.slice(0, 120).map((path, i) => [path, i % 9]));
  for (const count of [1, 10, 16]) {
    const parts = packShards(paths, durations, count);
    expect(parts).toHaveLength(count);
    expect(parts.flat().sort()).toEqual([...paths].sort());
    expect(new Set(parts.flat()).size).toBe(paths.length);
    expect(packShards([...paths].reverse(), durations, count)).toEqual(parts);
  }
});

test('measured long tests get separate partitions instead of sharing a fallback weight', () => {
  const paths = ['long-a', 'long-b', 'long-c', ...Array.from({ length: 100 }, (_, i) => `short-${i}`)];
  const durations = new Map(paths.map(path => [path, path.startsWith('long-') ? 100 : 1]));
  const parts = packShards(paths, durations, 10);
  expect(parts.filter(files => files.some(path => path.startsWith('long-')))).toHaveLength(3);
  for (const part of parts) expect(part.filter(path => path.startsWith('long-')).length).toBeLessThanOrEqual(1);
});

test('push behaviour matrix covers the complete current test discovery exactly once',()=>{
 const workflow=readFileSync('.github/workflows/deploy.yml','utf8'),behaviour=workflow.split('\n  behaviour:\n')[1];
 if(behaviour===undefined)throw new Error('Missing behaviour job');
 const matrix=/^\s+shard: \[([\d, ]+)\]/mu.exec(behaviour)?.[1]?.split(',').map(Number);
 const total=Number(/vitest run --shard=\$\{\{ matrix.shard \}\}\/(\d+)/u.exec(behaviour)?.[1]);
 expect(matrix).toEqual(Array.from({length:16},(_,i)=>i+1));
 expect(total).toBe(matrix?.length);
 const paths=['src','test','admin/test','drafts/test'].flatMap(root=>readdirSync(root,{recursive:true,encoding:'utf8'})
  .filter(file=>file.endsWith('.test.ts')).map(file=>`${root}/${file.replaceAll('\\','/')}`));
 const parts=packShards(paths,readDurations('.')??new Map(),total);
 const selected=matrix?.flatMap(index=>parts[index-1]??[]);
 expect(paths.length).toBeGreaterThan(0);
 expect(selected?.length).toBe(paths.length);
 expect([...(selected??[])].sort()).toEqual([...paths].sort());
 expect(new Set(selected).size).toBe(paths.length);
});
