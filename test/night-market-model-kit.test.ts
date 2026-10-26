// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only kit reader with the committed Blender GLB.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('kit models retint by palette slot, turn and stretch in place, and refuse what they cannot place', () => {
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareModelKit} from ${JSON.stringify(glb)};
const bytes=new Uint8Array(readFileSync('public/assets/open-plots/kit/lanterns.glb'));
const writer=()=>{const w={tris:[],lights:[]};w.triChannels=(role,points,colours,normals,uvs)=>w.tris.push({role,points,colours,normals,uvs});w.lanternEmitter=(at,colour)=>w.lights.push({at,colour});return w;};
const red=[0.5,0,0],kit=await prepareModelKit({stone:red},new Map([['lanterns',bytes]]));
assert.equal(kit.variants('lanterns'),3);
const seen=[];
for(let variant=0;variant<3;variant++){
 const w=writer();kit.placeModel(w,'lanterns',variant,10,-4);
 assert.ok(w.tris.length>50&&w.tris.length<400,'a lantern stays a low-poly piece');
 assert.equal(w.lights.length,1);
 for(const {role,points,colours,normals,uvs} of w.tris){
  assert.ok(role==='Kit'||role==='Glow');
  for(const p of points)assert.ok(Math.abs(p[0]-10)<1.2&&Math.abs(p[2]+4)<1.2&&p[1]>=-0.01&&p[1]<3.7);
  for(const c of colours)assert.ok(c.every(v=>v>=0&&v<=1));
  for(const n of normals)assert.ok(Math.abs(Math.hypot(...n)-1)<1e-3);
  for(const t of uvs)assert.ok(t.every(Number.isFinite));
 }
 // the layout's palette wins for its slots (stone, red here); every Kit corner is that colour times a shade in (0, 1]
 const stone=w.tris.filter(t=>t.role==='Kit'&&t.colours.every(c=>c[1]===0&&c[2]===0));
 assert.ok(stone.length>0);for(const t of stone)for(const c of t.colours)assert.ok(c[0]>0.15&&c[0]<=0.5);
 seen.push(w.tris.length);
}
assert.equal(new Set(seen).size,3,'three distinct variants');
// a quarter turn carries the front (+z) to +x; a taller post lifts the head and its light, not the base
const a=writer(),b=writer();kit.placeModel(a,'lanterns',1,0,0);kit.placeModel(b,'lanterns',1,0,0,{yaw:Math.PI/2});
assert.ok(Math.abs(b.lights[0].at[2]+a.lights[0].at[0])<1e-9&&Math.abs(b.lights[0].at[0]-a.lights[0].at[2])<1e-9);
const tall=writer();kit.placeModel(tall,'lanterns',0,0,0,{height:3.2});
const short=writer();kit.placeModel(short,'lanterns',0,0,0);
assert.ok(Math.abs(tall.lights[0].at[1]-short.lights[0].at[1]-0.6)<1e-6);
const low=t=>Math.min(...t.tris.flatMap(x=>x.points.map(p=>p[1])));assert.equal(low(tall),low(short));
for(const bad of [()=>kit.placeModel(writer(),'lanterns',3,0,0),()=>kit.placeModel(writer(),'stalls',0,0,0),()=>kit.placeModel(writer(),'lanterns',0,NaN,0)])assert.throws(bad,/invalid placement/);
await assert.rejects(()=>prepareModelKit({},new Map([['stalls',bytes]])),/invalid family record/);
// RM4.2: the stall family (hero stall, row stall, food cart), each lit by its own lanterns
const stalls=await prepareModelKit({},new Map([['stalls',new Uint8Array(readFileSync('public/assets/open-plots/kit/stalls.glb'))]]));
const lit=[0,1,2].map(variant=>{const w=writer();stalls.placeModel(w,'stalls',variant,0,0);assert.ok(w.tris.length>200&&w.tris.length<800);return w.lights.length;});
assert.deepEqual(lit,[3,1,1]);
// RM4.4: the house family (cottage, two-storey house, porch hall): every lit window and porch lantern an emitter
const houses=await prepareModelKit({},new Map([['houses',new Uint8Array(readFileSync('public/assets/open-plots/kit/houses.glb'))]]));
const windows=[0,1,2].map(variant=>{const w=writer();houses.placeModel(w,'houses',variant,0,0);assert.ok(w.tris.length>200&&w.tris.length<700);return w.lights.length;});
assert.deepEqual(windows,[3,8,5]);
await assert.rejects(()=>prepareModelKit({},new Map()),/no model families/);
await assert.rejects(()=>prepareModelKit({},new Map([['lanterns',new Uint8Array()]])),/missing GLB bytes/);
console.log('ok');`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  expect(output.trim()).toBe('ok');
});
