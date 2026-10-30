// oxlint-disable-next-line import/no-nodejs-modules -- Execute each bounded native capture and independent replay.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the genuinely earned continuation private to these two cases and remove it on every outcome.
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the checked-in runner, loader and owned scratch directory.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The same renderer-free loader as every trusted native worker.
import {pathToFileURL} from 'node:url';
import {afterAll,describe,expect,test} from 'vitest';
import {titanWireHash} from './fixtures/headless/titanHandoff';

mkdirSync(resolve('tmp'),{recursive:true});
const directory=mkdtempSync(resolve('tmp/nalati-titan-')),handoff=resolve(directory,'earned.json');
let checkedHash:string|undefined;
afterAll(()=>{rmSync(directory,{recursive:true,force:true});});
function run(stage:'opening'|'victory',hash?:string):string{
  const started=performance.now();
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/nalati-titan-run.ts'),stage,handoff,...(hash===undefined?[]:[hash])],{encoding:'utf8',timeout:150_000});
  expect(child.status,child.stdout+child.stderr+String(child.error??'')+(child.signal??'')).toBe(0);
  expect(child.stdout).toContain(`"story":"titan-${stage}"`);
  process.stdout.write(child.stdout);process.stdout.write(`${JSON.stringify({case:stage,childMs:performance.now()-started})}\n`);return child.stdout;
}
describe('the complete natural Titan fight',()=>{
  test('real storm, mounted arrows and support combat earn the checked fire phase',()=>{
    const report=run('opening'),hash=titanWireHash(readFileSync(handoff,'utf8'));
    expect(report).toContain(`"hash":"${hash}"`);checkedHash=hash;
  },180_000);
  test('the exact earned continuation wins and replays the remaining fight',()=>{
    expect(checkedHash,'the first case must earn and fully replay its checkpoint').toBeDefined();
    if(checkedHash===undefined)throw new Error('Missing checked Titan continuation');
    expect(titanWireHash(readFileSync(handoff,'utf8'))).toBe(checkedHash);
    run('victory',checkedHash);
  },180_000);
});
