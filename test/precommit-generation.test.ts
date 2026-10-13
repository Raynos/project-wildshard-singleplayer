import { expect, it } from 'vitest';
import { prepareCommitGeneration } from '../scripts/precommit-generation.mjs';
import { debugFlags, validateFlags } from '../lint/debug-flags.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated process fixtures and their actual cache bytes.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Restore only this fixture's environment after child completion.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the process fixtures outside shared source.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine fixture paths to their temporary tree.
import { resolve } from 'node:path';

function fixture() {
  const root=mkdtempSync(resolve(tmpdir(),'commit-preparation-'));
  for (const dir of ['src','lint','node_modules']) mkdirSync(resolve(root,dir));
  symlinkSync(resolve('node_modules/vite'),resolve(root,'node_modules/vite'));
  copyFileSync('lint/debug-flags.mjs',resolve(root,'lint/debug-flags.mjs'));
  writeFileSync(resolve(root,'src/old.ts'),'export const old=1;');
  return root;
}

it.each(['added','changed'])('keeps the final census and policy fresh after generation %s a file', async mode => {
  const root=fixture(), previous=process.env['WS_COMMIT_WITNESS_CACHE'], cache=resolve(root,'cache');
  try {
    process.env['WS_COMMIT_WITNESS_CACHE']=cache;
    const file=mode === 'added' ? 'src/late.ts' : 'src/old.ts';
    writeFileSync(resolve(root,'gen.mjs'), `import{existsSync,readdirSync,writeFileSync}from'node:fs';
const deadline=Date.now()+5000;
while(!existsSync('cache/debug-file-facts')||readdirSync('cache/debug-file-facts').length===0){if(Date.now()>deadline)throw Error('primer never ran');await new Promise(resolve=>setTimeout(resolve,5));}
writeFileSync(${JSON.stringify(file)},"ctx.debugRow({id:'new',ask:'E435',reviewBy:'2026-12-01'});");`);
    await prepareCommitGeneration(root,['gen.mjs']);
    const rows=debugFlags(root,cache);
    expect(rows.map(row=>row.id)).toEqual(['new']);
    expect(validateFlags(rows,{today:'2026-10-13',max:0,askExists:()=>true}).errors).toEqual(['debugRows: was 0, now 1; raise max and record the new ask in raisedBy']);
    writeFileSync(resolve(root,file),'ctx.debugRow(opaque);');
    expect(()=>debugFlags(root,cache)).toThrow('Unresolvable Debug row');
  } finally {
    if(previous===undefined)delete process.env['WS_COMMIT_WITNESS_CACHE'];else process.env['WS_COMMIT_WITNESS_CACHE']=previous;
    rmSync(root,{recursive:true,force:true});
  }
});

it.each(['generation','facts'])('settles both children before refusing failed %s preparation', async failure => {
  const root=fixture(), previous=process.env['WS_COMMIT_WITNESS_CACHE'];
  try {
    process.env['WS_COMMIT_WITNESS_CACHE']=resolve(root,'cache');
    writeFileSync(resolve(root,'lint/debug-flags.mjs'), `import{writeFileSync}from'node:fs';export function primeDebugFlagFacts(){writeFileSync('primer-started','');${failure==='facts' ? "throw Error('facts refused');" : "writeFileSync('primer-finished','');"}}`);
    writeFileSync(resolve(root,'gen.mjs'), `import{existsSync,writeFileSync}from'node:fs';
const deadline=Date.now()+5000;
while(!existsSync('primer-started')){if(Date.now()>deadline)throw Error('did not overlap');await new Promise(resolve=>setTimeout(resolve,5));}
await new Promise(resolve=>setTimeout(resolve,20));writeFileSync('generation-finished','');
${failure==='generation' ? "throw Error('generation refused');" : ''}`);
    await expect(prepareCommitGeneration(root,['gen.mjs'])).rejects.toThrow('Commit generation preparation failed');
    expect(readFileSync(resolve(root,'generation-finished'),'utf8')).toBe('');
    if(failure==='generation')expect(existsSync(resolve(root,'primer-finished'))).toBe(true);
  } finally {
    if(previous===undefined)delete process.env['WS_COMMIT_WITNESS_CACHE'];else process.env['WS_COMMIT_WITNESS_CACHE']=previous;
    rmSync(root,{recursive:true,force:true});
  }
});

it('retains generation without a configured fact cache', async () => {
  const root=fixture(),previous=process.env['WS_COMMIT_WITNESS_CACHE'];
  try {
    delete process.env['WS_COMMIT_WITNESS_CACHE'];
    writeFileSync(resolve(root,'lint/debug-flags.mjs'), "throw Error('unexpected primer');");
    writeFileSync(resolve(root,'gen.mjs'),"import{writeFileSync}from'node:fs';writeFileSync('generated','exact');");
    await prepareCommitGeneration(root,['gen.mjs']);
    expect(readFileSync(resolve(root,'generated'),'utf8')).toBe('exact');
  } finally {
    if(previous===undefined)delete process.env['WS_COMMIT_WITNESS_CACHE'];else process.env['WS_COMMIT_WITNESS_CACHE']=previous;
    rmSync(root,{recursive:true,force:true});
  }
});

it('leaves in-flight generated syntax to the full post-generation census', async () => {
  const root=fixture(),previous=process.env['WS_COMMIT_WITNESS_CACHE'],cache=resolve(root,'cache');
  try {
    process.env['WS_COMMIT_WITNESS_CACHE']=cache;
    writeFileSync(resolve(root,'src/inflight.generated.ts'),'const unfinished =');
    writeFileSync(resolve(root,'gen.mjs'), `import{existsSync,readdirSync,writeFileSync}from'node:fs';
const deadline=Date.now()+5000;
while(!existsSync('cache/debug-file-facts')||readdirSync('cache/debug-file-facts').length===0){if(Date.now()>deadline)throw Error('primer never ran');await new Promise(resolve=>setTimeout(resolve,5));}
writeFileSync('src/inflight.generated.ts',"ctx.debugRow({id:'generated',ask:'E435',reviewBy:'2026-12-01'});");`);
    await prepareCommitGeneration(root,['gen.mjs']);
    const rows=debugFlags(root,cache);
    expect(rows.map(row=>row.id)).toEqual(['generated']);
    expect(validateFlags(rows,{today:'2026-10-13',max:0,askExists:()=>true}).errors).toHaveLength(1);
  } finally {
    if(previous===undefined)delete process.env['WS_COMMIT_WITNESS_CACHE'];else process.env['WS_COMMIT_WITNESS_CACHE']=previous;
    rmSync(root,{recursive:true,force:true});
  }
});
