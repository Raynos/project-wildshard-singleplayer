// Reproduce the pinned ledger from Git objects, without a checkout or repository copy.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {resolve} from 'node:path';
import {codeLines} from '../../../scripts/shard-platform.mjs';

const root=resolve(import.meta.dirname,'../../..');
const actual=JSON.parse(readFileSync(resolve(root,'lint/legacy-line-basis.json'),'utf8'));
const revision='1258254a368566f52dac078512cf96095356a174';
const read=path=>JSON.parse(execFileSync('git',['show',`${revision}:${path}`],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
const inventory=read('lint/legacy-shards.json');
const generated=new Set([...read('scripts/generation-jobs.json').jobs.flatMap(job=>job.outputs),
  ...Object.values(read('scripts/source-generation-outputs.json').producers).flat()]);
const shards={};
for(const [folder,row] of Object.entries(inventory.shards)) {
  const excluded=Object.keys(row.files).filter(path=>generated.has(`src/shards/${row.primary}/${path}`));
  const eligible=Object.keys(row.files).filter(path=>/\.tsx?$/u.test(path)&&!path.endsWith('.d.ts')
    &&!/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.tsx?$/u.test(path)&&!excluded.includes(path));
  const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,maxBuffer:16*1024*1024,
    input:eligible.map(path=>`${revision}:src/shards/${folder}/${path}\n`).join('')});
  let cursor=0;
  const files={};
  for(const path of eligible) {
    const end=bytes.indexOf(10,cursor),header=bytes.subarray(cursor,end).toString();
    if(!/^[a-f0-9]+ blob [0-9]+$/u.test(header))throw new Error(`Missing historical blob: ${folder}/${path}`);
    const size=Number(header.split(' ')[2]);
    files[path]=codeLines(bytes.subarray(end+1,end+size+1).toString(),path);
    cursor=end+size+2;
  }
  shards[row.primary]={source:row.source,excluded,files};
}
if(!isDeepStrictEqual(actual,{schema:'legacy-line-basis/1',revision,shards}))throw new Error('Frozen line basis differs from historical checkpoint');
console.info('Verified all six frozen per-file counts and exact historical exclusions at 1258254a3.');
