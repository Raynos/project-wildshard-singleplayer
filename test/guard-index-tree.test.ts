import {expect,it} from 'vitest';
import {guardIndexTree} from '../scripts/guard-index-tree.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real Git index format in an owned fixture.
import {execFileSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Every file belongs to this isolated temporary fixture.
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary root only.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the caller's actual private index environment.
import {env} from 'node:process';

it('reads locked regular, split and private indexes without changing caller bytes and refuses corruption',()=>{
  const root=mkdtempSync(join(tmpdir(),'guard-index-fixture-'));
  const prior=env['GIT_INDEX_FILE'];
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  try {
    delete env['GIT_INDEX_FILE'];git('init','-q');
    writeFileSync(join(root,'source.ts'),'export const value=1;');git('add','source.ts');
    const check=(index:string)=>{
      const expected=git('write-tree'),before=readFileSync(index);
      writeFileSync(`${index}.lock`,'fixture owns the real index writer lock');
      try {expect(guardIndexTree(root)).toBe(expected);expect(readFileSync(index)).toEqual(before);}
      finally {rmSync(`${index}.lock`);}
    };
    check(join(root,'.git/index'));
    git('update-index','--split-index');check(join(root,'.git/index'));
    const privateIndex=join(root,'private-index');copyFileSync(join(root,'.git/index'),privateIndex);
    env['GIT_INDEX_FILE']=privateIndex;check(privateIndex);
    writeFileSync(privateIndex,'not a Git index');expect(()=>guardIndexTree(root)).toThrow();
  } finally {
    if(prior===undefined)delete env['GIT_INDEX_FILE'];else env['GIT_INDEX_FILE']=prior;
    rmSync(root,{recursive:true,force:true});
  }
});
