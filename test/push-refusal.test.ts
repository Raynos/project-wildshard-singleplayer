// oxlint-disable-next-line import/no-nodejs-modules -- Exercise isolated immutable commit identities.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the fixture repository, traces and generation receipts.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Put fixtures outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths only.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { recordPushRefusal, unchangedPushRefusal } from '../scripts/push-refusal.mjs';
import { inputKey } from '../scripts/commit-inputs.mjs';

it('defers unchanged failures across other lanes and retries observed input repairs', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(),'push-refusal-')));
  const git = (...args: string[]) => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const put = (file: string, bytes: string) => { mkdirSync(join(root,file,'..'),{recursive:true});writeFileSync(join(root,file),bytes); };
  const commit = () => { git('add','.');git('-c','core.hooksPath=/dev/null','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD'); };
  try {
    git('init','-q');put('src/culprit.ts','red');put('src/other.ts','before');put('package.json','{}');
    const red = commit(), trace = join(root,'.git/trace');mkdirSync(trace);
    writeFileSync(join(trace,'1.trace'),`F ${join(root,'src/culprit.ts')}\nF ${join(root,'src/generated.json')}`);
    const receipt = (sha: string, digest: string) => { const dir=join(root,'.git/commit-inputs');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,`${inputKey(root,sha)}.json`),JSON.stringify({'src/generated.json':digest})); };
    receipt(red,'before');recordPushRefusal(root,red,root,[trace]);
    put('src/other.ts','another lane');const other=commit();receipt(other,'before');
    // Foreign working edits cannot repair an immutable failed commit.
    put('src/culprit.ts','uncommitted fix');
    expect(unchangedPushRefusal(root,red,other)).toBe(true);
    const fixed=commit();receipt(fixed,'before');expect(unchangedPushRefusal(root,red,fixed)).toBe(false);
    put('src/culprit.ts','red');const original=commit();receipt(original,'after');expect(unchangedPushRefusal(root,red,original)).toBe(false);
    // Unknown or killed checks use the complete generation-input key, not a partial trace.
    recordPushRefusal(root,original,root,[]);put('docs/note.md','docs only');const doc=commit();receipt(doc,'after');
    expect(unchangedPushRefusal(root,original,doc)).toBe(true);
    put('src/other.ts','new code');const code=commit();receipt(code,'after');expect(unchangedPushRefusal(root,original,code)).toBe(false);
    put(`.git/push-refusals/${red}.json`,'broken');expect(unchangedPushRefusal(root,red,other)).toBe(false);
    expect(readFileSync(join(root,'src/culprit.ts'),'utf8')).toBe('red');
  } finally { rmSync(root,{recursive:true,force:true}); }
});


it('retries a native lint operand repair even when Node only read policy', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'push-native-refusal-')));
  const git = (...args: string[]) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  const commit = () => {git('add', '.'); git('-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD');};
  try {
    git('init', '-q'); writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'native.test.ts'), 'missing blank line');
    const red = commit(), trace = join(root, '.git/native-trace');
    execFileSync('python3', ['-c', `import importlib.util,pathlib,sys
s=importlib.util.spec_from_file_location('gate',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
m.record_command_inputs(pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),['native.test.ts'])`, resolve('scripts/local-gate.py'), trace, root]);
    writeFileSync(join(trace, 'node.trace'), `F ${join(root, 'package.json')}`);
    recordPushRefusal(root, red, root, [trace]);
    writeFileSync(join(root, 'note.md'), 'other lane'); const other = commit();
    expect(unchangedPushRefusal(root, red, other)).toBe(true);
    writeFileSync(join(root, 'native.test.ts'), 'blank line fixed'); const fixed = commit();
    expect(unchangedPushRefusal(root, red, fixed)).toBe(false);
  } finally {rmSync(root, {recursive: true, force: true});}
});
