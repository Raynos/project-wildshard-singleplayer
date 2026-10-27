// oxlint-disable-next-line import/no-nodejs-modules -- Exercise build-only source modules with the actual GLB decoder.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('lantern vertex bake preserves neutral words, sums compact linear light and refuses atomically over the kit models', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bakeLanternVertices,buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {prepareModelKit} from ${JSON.stringify(glb)};
const profile={gain:1,radius:1,cut:2},light={at:[0,0,0],colour:[1,.5,.25]};
const source={positions:[0,0,0,1,0,0,2,0,0,3,0,0],colours:Array(12).fill(0)};
assert.deepEqual(bakeLanternVertices(source,[light],profile),[1,.5,.25,.28125,.140625,.0703125,0,0,0,0,0,0]);
assert.deepEqual(source.colours,Array(12).fill(0));
const clamped=bakeLanternVertices({positions:[0,0,0],colours:[.1,.2,.3]},[light,light],profile);
assert.deepEqual(clamped,[1,1,.8]);
const neutral={positions:[0,0,0],colours:[-0,.1,1]},unchanged=bakeLanternVertices(neutral,[light],{...profile,gain:0});
assert.notEqual(unchanged,neutral.colours);assert.deepEqual(unchanged,neutral.colours);assert.ok(Object.is(unchanged[0],-0));
const copy=structuredClone(source);
for(const bad of [{gain:NaN},{gain:-1},{radius:0},{radius:'1'},{radius:Infinity},{radius:1e-300},{cut:0},{cut:Infinity}]){
 assert.throws(()=>bakeLanternVertices(source,[light],{...profile,...bad}),/falloff/);
 assert.deepEqual(source,copy);
}
for(const bad of [{positions:[NaN,0,0]},{positions:[0,0]},{positions:Array(3)},{colours:[0,Infinity,0]},{colours:[0,-1,0]}]){
 assert.throws(()=>bakeLanternVertices({...neutral,...bad},[light],profile),/vertices/);
}
for(const bad of [{at:[Infinity,0,0],colour:[1,1,1]},{at:Array(3),colour:[1,1,1]},{at:[0,0,0],colour:[1,2,1]}]){
 assert.throws(()=>bakeLanternVertices(source,[light,bad],profile),/emitter/);assert.deepEqual(source,copy);
}
assert.throws(()=>bakeLanternVertices(source,Array(1),profile),/emitter/);
const layout=JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json','utf8'));
const palette=Object.fromEntries(Object.entries(layout.palette).map(([key,s])=>[key,[1,3,5].map(at=>{const c=parseInt(s.slice(at,at+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4})]));
const parts=Object.fromEntries(['Kit','Glow','Pool','Water','far','solid','detailKit','detailGlow','coarse'].map(role=>[role,new Soup()])),before=[];
const kit=await prepareModelKit(palette,new Map([['lanterns',new Uint8Array(readFileSync('public/assets/open-plots/kit/lanterns.glb'))]]));
buildLayout(parseLayout(layout.rows),parts,palette,(r,c)=>(r*7+c*3)%2,{...kit,lanternEmitter:(at,colour)=>before.push({at,colour})});
for(const light of before)assert.ok(light.at.every(Number.isFinite)&&light.colour.every(c=>c>=0&&c<=1));
const surface=parts.Kit.part('Kit');
assert.deepEqual(bakeLanternVertices(surface,before,{gain:0,radius:1.5,cut:3}),surface.colours);
console.log(before.length);`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  // RM8.4's plaza beds add 16 lanterns when the lantern family is on
  expect(Number(output.trim())).toBe(5500);
});
