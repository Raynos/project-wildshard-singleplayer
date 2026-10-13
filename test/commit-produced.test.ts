import { expect, it } from 'vitest';
import { recordCommitProduced, verifyCommitProduced } from '../scripts/commit-produced.mjs';
import { precommitGenerated } from '../scripts/precommit-generated.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual private-tree admission in an owned Git fixture.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only fixture-owned files are written and removed.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the isolated repository outside main.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Give the real fixture guard an exact source intent.
import process from 'node:process';

it('admits only produced outputs of the exact source/index/parent and keeps source guards intact', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-produced-'));
  const git = (...args:string[]) => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const manifest = 'test/proof/fixture/checkpoints/manifest.json';
  const inventory = 'docs/plans/shard-platform/generator-inventory.md';
  const put = (file:string, value:string) => {mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),value);};
  try {
    git('init','-q'); git('config','core.hooksPath','/dev/null');
    put('src/game/source.ts','before'); put('scripts/generation-jobs.json','{"jobs":[]}');
    put(manifest,JSON.stringify({inputs:'abc1',outcome:'unchanged'},null,2));
    put(inventory,'before inventory');
    git('add','.'); git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-qm','fixture');
    const base = git('rev-parse','HEAD');
    put('src/game/source.ts','after'); git('add','src/game/source.ts');
    const source = git('write-tree');
    put(manifest,JSON.stringify({inputs:'abc2',outcome:'unchanged'},null,2)); git('add',manifest);
    put(inventory,'produced inventory');git('add',inventory);
    expect(() => precommitGenerated(root)).toThrow('exact commit-time producer receipt');
    recordCommitProduced(root,source,[manifest,inventory],base);
    const produced = git('write-tree');
    expect(verifyCommitProduced(root,produced,[manifest,inventory])).toBe(true);
    expect(verifyCommitProduced(root,produced,[manifest],source)).toBe(true);
    expect(verifyCommitProduced(root,produced,[manifest],git('rev-parse',`${base}^{tree}`))).toBe(false);
    expect(verifyCommitProduced(root,produced,['src/game/source.ts'])).toBe(false);
    expect(() => precommitGenerated(root)).not.toThrow();
    put('docs/unlisted.md','not a declared producer');git('add','docs/unlisted.md');
    expect(()=>recordCommitProduced(root,source,[manifest,inventory,'docs/unlisted.md'],base)).toThrow('cannot cover source or undeclared');
    git('read-tree',produced);
    const guard = () => spawnSync('python3',[resolve('scripts/check-commit-index.py')],{cwd:root,encoding:'utf8',env:{...process.env,WS_COMMIT_INTENT:JSON.stringify({base,paths:['src/game/source.ts']})}});
    expect(guard().status).toBe(0);
    put('src/game/source.ts','foreign later edit'); git('add','src/game/source.ts');
    expect(verifyCommitProduced(root,git('write-tree'),[manifest])).toBe(false);
    expect(guard().status).toBe(1);
    expect(() => recordCommitProduced(root,source,[manifest,'src/game/source.ts'],base)).toThrow('cannot cover source');
    git('read-tree',produced);
    const next = git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit-tree',git('rev-parse',`${base}^{tree}`),'-p',base,'-m','fixture');
    git('update-ref','HEAD',next,base);
    expect(verifyCommitProduced(root,produced,[manifest])).toBe(false);
    expect(verifyCommitProduced(root,produced,[manifest],source)).toBe(false);
  } finally {rmSync(root,{recursive:true,force:true});}
});
