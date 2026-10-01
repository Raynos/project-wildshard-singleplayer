import { copyFileSync, mkdirSync, writeFileSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { array, flatten, get, number, object, percentile, set, string } from './value.mjs';
import { normalize } from './compare.mjs';
import { ssim } from './ssim.mjs';

/** @param {import('playwright').Page} page @param {string} golden @param {string} current @param {number[][]} masks */
export function imageScore(page,golden,current,masks) {return page.evaluate(ssim,{a:readFileSync(golden).toString('base64'),b:readFileSync(current).toString('base64'),mask:masks});}
/** @param {import('playwright').Page} page @param {import('./value.mjs').RecordValue[]} runs @param {{sha:string,browser:string}} meta */
export async function aggregate(page,runs,meta) {
  const records=runs.map(normalize),base=structuredClone(records[0]??{}),flat=flatten(base),spread=/** @type {import('./value.mjs').RecordValue} */ ({}),selfMin=/** @type {import('./value.mjs').RecordValue} */ ({});
  for(const [path,v] of Object.entries(flat)) {
    if(typeof v==='number') {const values=records.map((r)=>number(get(r,path)));if(values.every(Number.isFinite)){set(base,path,percentile(values));spread[path]=Math.max(...values)-Math.min(...values);}}
    else if(Array.isArray(v) && v.every((x)=>typeof x==='number')) {
      const vectors=records.map((r)=>array(get(r,path))),ranges=v.map((_,i)=>{const values=vectors.map((vec)=>number(vec[i]));return Math.max(...values)-Math.min(...values);});
      set(base,path,v.map((_,i)=>percentile(vectors.map((vec)=>number(vec[i])))));spread[path]=Math.max(...ranges);
    }
    else if(path.endsWith('.ambient'))set(base,path,array(v).filter((id)=>records.every((r)=>array(get(r,path)).includes(id))));
  }
  for(const [name,pose] of Object.entries(object(base.poses))) {
    const golden=string(object(pose).shot),boxes=/** @type {number[][]} */ (array(object(pose).boxes));
    const scores=[];
    for(const record of records.slice(1)) {const p=object(get(record,`poses.${name}`)),score=await imageScore(page,golden,string(p.shot),[...boxes,.../** @type {number[][]} */ (array(p.boxes))]);scores.push(score.ssim ?? 0);}
    selfMin[name]=Math.min(1,...scores);object(pose).ssim=1;
  }
  return {...base,spread,selfMin,harness:1,sha:meta.sha,recorded:new Date().toISOString(),browser:meta.browser};
}
/** @param {string} root @param {string} lane @param {string} shard @param {string} tier @param {import('./value.mjs').RecordValue} baseline @param {string[]|undefined} fields */
export function writeBaseline(root,lane,shard,tier,baseline,fields) {
  const dir=join(root,'test/parity/baselines',lane);mkdirSync(dir,{recursive:true});
  for(const [name,pose] of Object.entries(object(baseline.poses))) {
    if(fields && !fields.some((p)=>p.startsWith(`poses.${name}`)))continue;
    const target=join(dir,`${shard}.${tier}.${name}.jpg`);copyFileSync(string(object(pose).shot),target);object(pose).shot=target;
  }
  writeFileSync(join(dir,`${shard}.${tier}.json`),`${JSON.stringify(baseline,null,2)}\n`);
}
