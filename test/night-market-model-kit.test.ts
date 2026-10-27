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
// RM4.5: the arched half-bridges (rails, parapet, crown lanterns), every one spanning the 23 m border
const bridges=await prepareModelKit({},new Map([['bridges',new Uint8Array(readFileSync('public/assets/open-plots/kit/bridges.glb'))]]));
const crowns=[0,1,2].map(variant=>{const w=writer();bridges.placeModel(w,'bridges',variant,0,0);const xs=w.tris.flatMap(t=>t.points.map(q=>q[0]));
 assert.ok(Math.min(...xs)<-11.4&&Math.max(...xs)>11.4);return w.lights.length;});
assert.deepEqual(crowns,[0,0,2]);
// RM4.3: a lane's strings (bulb, paper lantern, lane post); the y option hangs a bulb on its cord, lifting its light with it
const strings=await prepareModelKit({},new Map([['strings',new Uint8Array(readFileSync('public/assets/open-plots/kit/strings.glb'))]]));
const hung=[0,1,2].map(variant=>{const w=writer();strings.placeModel(w,'strings',variant,0,0,{y:5});return w.lights.map(l=>l.at[1]);});
assert.equal(hung[0].length,1);assert.equal(hung[1].length,1);assert.equal(hung[2].length,0);
assert.ok(Math.abs(hung[0][0]-5)<1e-6&&hung[1][0]<5&&hung[1][0]>4.5);
// RM4.6: street props (flower planter, bench, crate stack), unlit and small
const props=await prepareModelKit({},new Map([['props',new Uint8Array(readFileSync('public/assets/open-plots/kit/props.glb'))]]));
for(const variant of [0,1,2]){const w=writer();props.placeModel(w,'props',variant,0,0);assert.equal(w.lights.length,0);assert.ok(w.tris.length>20&&w.tris.length<600);}
// RM4.7: trees (round and tall generated by Hunyuan3D-2, the willow scripted), 8 m as built; scale stands one to a tree's crown top
const trees=await prepareModelKit({},new Map([['trees',new Uint8Array(readFileSync('public/assets/open-plots/kit/trees.glb'))]]));
for(const variant of [0,1,2]){const w=writer();trees.placeModel(w,'trees',variant,0,0,{scale:0.5});const ys=w.tris.flatMap(t=>t.points.map(q=>q[1]));
 assert.equal(w.lights.length,0);assert.ok(w.tris.length>=300&&w.tris.length<=(variant===2?850:600));assert.ok(Math.max(...ys)>3.8&&Math.max(...ys)<4.2&&Math.min(...ys)>-0.05);}
// G755: hand-built figures (vendor, shopper, elder; kit.py scripted_figure), 1.75 m, ~360 triangles, painted faces
const figures=await prepareModelKit({},new Map([['figures',new Uint8Array(readFileSync('public/assets/open-plots/kit/figures.glb'))]]));
for(const variant of [0,1,2]){const w=writer();figures.placeModel(w,'figures',variant,0,0);const ys=w.tris.flatMap(t=>t.points.map(q=>q[1]));
 assert.ok(w.tris.length>=250&&w.tris.length<=450);assert.ok(Math.max(...ys)>1.7&&Math.max(...ys)<1.8);}
// RM7.1: canal coping (plain, bollard, steps), its origin on the wall line and its lip over the water in front (+z)
const canal=await prepareModelKit({},new Map([['canal',new Uint8Array(readFileSync('public/assets/open-plots/kit/canal.glb'))]]));
for(const variant of [0,1,2]){const w=writer();canal.placeModel(w,'canal',variant,0,0);const zs=w.tris.flatMap(t=>t.points.map(q=>q[2]));
 assert.ok(Math.min(...zs)<-0.75&&Math.max(...zs)>0.1&&Math.max(...zs)<(variant===2?1:0.2));}
await assert.rejects(()=>prepareModelKit({},new Map()),/no model families/);
await assert.rejects(()=>prepareModelKit({},new Map([['lanterns',new Uint8Array()]])),/missing GLB bytes/);
console.log('ok');`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  expect(output.trim()).toBe('ok');
});
