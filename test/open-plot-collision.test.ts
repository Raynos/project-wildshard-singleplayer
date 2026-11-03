// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual Node-only registered kit producer without a type-only facade.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { expect, test } from 'vitest';

test('all quarter-turns keep kit drawing exact and register lantern and stall posts', () => {
  const source = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const builders = new URL('../src/shards/open-plots/generators/nightMarket.mjs', import.meta.url).href;
  const program = `import { createHash } from 'node:crypto';
import { buildLayout, Soup } from ${JSON.stringify(source)};
import {nightMarketBuilders} from ${JSON.stringify(builders)};
const palette = new Proxy({}, {get: () => [.4,.4,.4]});
const results=[];
for(const type of ['H','S']) for(let turns=0;turns<4;turns++) {
 const localGeometry=[],geometryArity={tri:4,triColours:4,quad:5,box:3,sides:3,floor:6,solid:2};
 const builders=nightMarketBuilders(),tile=builders.tiles[type];
 const trace=call=>(writer,...args)=>call(new Proxy(writer,{get(target,key){
  const value=target[key];if(typeof value!=='function'||!Object.hasOwn(geometryArity,key))return value;
  return(...values)=>{localGeometry.push([key,values.slice(0,geometryArity[key])]);return value(...values);};
 }}),...args);
 builders.tiles[type]={...tile,build:trace(tile.build),far:trace(tile.far)};
 const parts=Object.fromEntries(['Kit','Glow','Water','Pool','Mover','far','solid'].map(key=>[key,new Soup()]));
 buildLayout(Array.from({length:8},()=>Array.from({length:8},()=>({type,turns}))),parts,palette,()=>0,undefined,builders);
 const positions=parts.solid.part('Solid').positions;
 let posts=0;
 for(let i=0;i<positions.length;i+=108){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let j=0;j<108;j++){const axis=j%3,value=positions[i+j];lo[axis]=Math.min(lo[axis],value);hi[axis]=Math.max(hi[axis],value);}
  const width=hi[0]-lo[0],depth=hi[2]-lo[2],height=hi[1]-lo[1];
  if(type==='H'&&Math.abs(width-.18)<1e-6&&Math.abs(depth-.18)<1e-6&&(height===2.4||height===2.8))posts++;
  if(type==='S'&&Math.abs(width-.36)<1e-6&&Math.abs(depth-.36)<1e-6&&height===3.6)posts++;
 }
 const visual=createHash('sha256').update(JSON.stringify(Object.entries(parts).filter(([key])=>key!=='solid').map(([key,soup])=>[key,[...soup.parts]]))).digest('hex');
 results.push({type,turns,posts,visual,geometry:createHash('sha256').update(JSON.stringify(localGeometry)).digest('hex')});
}
console.log(JSON.stringify(results));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' });
  const rows = v.parse(v.array(v.object({ type: v.string(), turns: v.number(), posts: v.number(), visual: v.string(), geometry: v.string() })), JSON.parse(output));
  expect(rows.map(({ type, turns, posts }) => ({ type, turns, posts }))).toEqual(
    ['H', 'S'].flatMap(type => [0, 1, 2, 3].map(turns => ({ type, turns, posts: type === 'H' ? 448 : 2560 }))),
  );
  // The authored tile-local points/bounds/topology are identical at all four
  // rotations. Plot-axis seam life remains covered by each strict full hash.
  for (const type of ['H', 'S']) expect(new Set(rows.filter(row => row.type === type).map(row => row.geometry)).size).toBe(1);
  // OP1 (43f9809f0d/d141a00252): remove only sky-lantern triangles and
  // resequence firefly/steam phases. All other soup words and posts are exact.
  // Keep every complete positions/normals/colours/UVs hash strict.
  expect(rows.map(row => row.visual)).toEqual([
    "f0fd0f68f69aa13a90d4364b345d8b69d426346a55e959ff4bdc9067ac517205",
    "1744853cf161bc7ae06e9c19aa686ab713c5cfd6104fea85a70fb0f536aa3776",
    "43f54868d628c5b1a1bb7da3daf567cde5e8f91b3897f911551420422e89d7c7",
    "f65c6d84944d81dd25a2b55000ba6ad9c7a514d8e1e4ac88d0b0d782cfe83968",
    "301592fb4e43b977574153fe11e63d21c68f36465abebf52efee0210bf4f0a5f",
    "efd03934e52ef1ee8b46e51714571617beb1f37dabe40100134b88d891e591c5",
    "d9d8def97e8f55c93f46db2c05684e211b7594aba3bae8f2d9277c59fca068e2",
    "fb0dead74d436f37b0841303022d4a8b2ed15c20a87ab904f7f7ba3be0b29969"
]);
});
