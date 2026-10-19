// oxlint-disable-next-line import/no-nodejs-modules -- Validate the shipping producer catalogue, not a hand-made fixture.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as v from 'valibot';

it('prepares painted models before native dressing loads them',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string())}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 const paint=jobs.find(job=>job.id==='nalati-model-paint');
 const dressing=jobs.find(job=>job.id==='nalati-dressing-plan');
 if(paint===undefined||dressing===undefined)throw new Error('Missing Nalati producer');
 expect(jobs.indexOf(paint)).toBeLessThan(jobs.indexOf(dressing));
 expect(paint.outputs.length).toBe(43);
 for(const file of paint.outputs)expect(dressing.inputRoots.some(input=>file===input||file.startsWith(`${input}/`))).toBe(true);
});

it('prepares the dressing keep-outs before the grass coverage reader',()=>{
 const {jobs}=v.parse(v.object({jobs:v.array(v.object({id:v.string(),inputRoots:v.array(v.string()),outputs:v.array(v.string()),buildTimeOutputs:v.optional(v.array(v.string()),[])}))}),
  JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 const dressing=jobs.find(job=>job.id==='nalati-dressing-plan');
 const grass=jobs.find(job=>job.id==='nalati-grass');
 if(dressing===undefined||grass===undefined)throw new Error('Missing Nalati producer');
 const coverInputs=grass.inputRoots.filter(file=>file.includes('/dressing-')&&file.endsWith('.generated.json'));
 expect(coverInputs.length).toBeGreaterThan(0);
 expect(jobs.indexOf(dressing)).toBeLessThan(jobs.indexOf(grass));
 for(const file of coverInputs){
  expect(dressing.outputs).toContain(file);
  expect(dressing.buildTimeOutputs).toContain(file);
 }
});
