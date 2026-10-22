// oxlint-disable-next-line import/no-nodejs-modules -- Compare only owned miniature ruler fixtures.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every fixture below the repository scratch root.
import {resolve} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {shardLines} from '../scripts/shard-platform.mjs';
import {shardLineBaselines} from '../scripts/decision-legacy-lines.mjs';
import {platformOutput} from './fixtures/platformOutputs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
it('keeps all six ruler baselines and zero verdicts when the legacy list is emptied',()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/ruler-no-legacy-'));owned.push(root);
  mkdirSync(resolve(root,'lint'));
  writeFileSync(resolve(root,'lint/legacy-line-basis.json'),readFileSync('lint/legacy-line-basis.json'));
  const baselines=shardLineBaselines(root);
  expect(baselines.size).toBe(6);
  expect([...baselines.values()].reduce((sum,row)=>sum+row.lines,0)).toBe(98854);
  let index=0;
  for(const [slug] of baselines) {
    platformOutput(root,slug,index++===0?{'runtime/index.ts':'export const LIVE=1;'}:{});
    writeFileSync(resolve(root,`src/shards/${slug}/manifest.ts`),'export default {};');
  }
  writeFileSync(resolve(root,'lint/legacy-shards.json'),JSON.stringify({version:1,sealed:true,
    shards:Object.fromEntries([...baselines].map(([slug,row])=>[`${slug}-legacy`,{primary:slug,source:row.source,
      files:{'manifest.ts':'a'.repeat(64),'plugin.ts':'b'.repeat(64)}}]))}));
  const before=shardLines(root);
  expect(Object.keys(before).sort()).toEqual([...baselines.keys()].sort());
  expect(Object.values(before).filter(row=>row.conversion.passed)).toHaveLength(5);
  for(const [slug,baseline] of baselines)expect(before[slug]?.conversion).toMatchObject({
    legacyLines:baseline.lines,legacyRevision:baseline.source,metric:'runtime-vs-legacy'});
  writeFileSync(resolve(root,'lint/legacy-shards.json'),JSON.stringify({version:1,sealed:true,shards:{}}));
  expect(shardLines(root)).toEqual(before);
});
