// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only core in its native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('a plot owns its tile letters, sockets and paving without the Night Market builder set', () => {
  const core = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,checkLayout,parseLayout,paving,sockets,Soup} from ${JSON.stringify(core)};
const built=[],far=[],variants=[];
const tiles={tiles:{X:{sockets:'pppp',build:(w,p,variant)=>{built.push(variant);w.box('Kit',[-1,0,-1],[1,2,1],[.1,.2,.3]);w.solid([-1,0,-1],[1,2,1]);},far:(w,p,variant)=>far.push(variant)}},coarseFamilies:new Set()};
const rows=Array(8).fill(Array(8).fill('X1').join(' ')),grid=parseLayout(rows,tiles);
const parts=Object.fromEntries(['Kit','solid'].map(name=>[name,new Soup()]));
buildLayout(grid,parts,{},(r,c)=>{variants.push([r,c]);return r*8+c;},undefined,tiles);
assert.deepEqual(built,Array.from({length:64},(_,i)=>i));assert.deepEqual(far,built);
assert.equal(variants.length,128);assert.equal(parts.Kit.part('Kit').positions.length,64*90);assert.equal(parts.solid.part('Solid').positions.length,64*108);
assert.ok(paving(grid,246.25,tiles).length>0);
assert.throws(()=>parseLayout(Array(8).fill(Array(8).fill('H0').join(' ')),tiles),/bad tile/);
assert.throws(()=>parseLayout(rows.slice(1),tiles),/eight rows/);
assert.throws(()=>parseLayout(['X0',...rows.slice(1)],tiles),/eight tiles/);
const wet={tiles:{Y:{sockets:'wpwp',water:[[-2,-31.25,2,31.25]]}},coarseFamilies:new Set()};
assert.deepEqual(sockets('Y',1,wet),['p','w','p','w']);
assert.throws(()=>checkLayout(parseLayout(Array(8).fill(Array(8).fill('Y0').join(' ')),wet),wet),/edge/);
const water=paving(parseLayout(Array(8).fill(Array(8).fill('Y1').join(' ')),wet),246.25,wet);
assert.ok(water.every(([x0,z0,x1,z1])=>x1>x0&&z1>z0));
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
