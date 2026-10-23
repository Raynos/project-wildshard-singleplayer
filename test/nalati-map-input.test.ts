import {afterEach,expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- This regression stages only declared metadata in an owned sandbox.
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Redirect the map reader into the owned fixture.
import {dirname,resolve} from 'node:path';
import * as v from 'valibot';
import {readNalatiMapPlaces} from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(files:Record<string,unknown>):string {
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp','nalati-map-input-'));owned.push(root);
 for(const [name,value]of Object.entries(files)){const path=resolve(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value));}
 return root;
}

test('reads staged data metadata without an incidental boot copy and retains numeric decoding',()=>{
 const prepared={places:{rows:[]},view:{sequence:[]},dressing:{rows:[]},sample:['-0','Infinity','-Infinity']};
 const root=fixture({'data/placeRuntime.generated.json':prepared});
 expect(readNalatiMapPlaces(root)).toEqual({...prepared,sample:[-0,Infinity,-Infinity]});
});

test('a missing declared data copy refuses rather than reading stale boot metadata',()=>{
 const root=fixture({'boot/placeRuntime.generated.json':{projection:'stale'}});
 expect(()=>readNalatiMapPlaces(root)).toThrow('ENOENT');
});

test('the canonical data copy is produced with the exact same pinned bytes as the boot alias',()=>{
 const catalog=v.parse(v.object({jobs:v.array(v.object({id:v.string(),outputs:v.array(v.string()),buildOutputs:v.optional(v.record(v.string(),v.string()))}))}),JSON.parse(readFileSync('scripts/generation-jobs.json','utf8')));
 const job=catalog.jobs.find(row=>row.id==='nalati-place-runtime');
 const data='src/shards/nalati-grasslands/data/placeRuntime.generated.json',boot='src/shards/nalati-grasslands/boot/placeRuntime.generated.json';
 expect(job?.outputs).toEqual(expect.arrayContaining([data,boot]));
 expect(job?.buildOutputs?.[data]).toMatch(/^[a-f0-9]{64}$/u);expect(job?.buildOutputs?.[data]).toBe(job?.buildOutputs?.[boot]);
});
