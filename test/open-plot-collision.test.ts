// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual Node-only registered kit producer without a type-only facade.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { expect, test } from 'vitest';

test('all quarter-turns keep kit drawing exact and register lantern and stall posts', () => {
  const source = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const program = `import { createHash } from 'node:crypto';
import { buildLayout, Soup } from ${JSON.stringify(source)};
const palette = new Proxy({}, {get: () => [.4,.4,.4]});
const results=[];
for(const type of ['H','S']) for(let turns=0;turns<4;turns++) {
 const parts=Object.fromEntries(['Kit','Glow','Water','Pool','Mover','far','solid'].map(key=>[key,new Soup()]));
 buildLayout(Array.from({length:8},()=>Array.from({length:8},()=>({type,turns}))),parts,palette,()=>0);
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
 results.push({type,turns,posts,visual});
}
console.log(JSON.stringify(results));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' });
  const rows = v.parse(v.array(v.object({ type: v.string(), turns: v.number(), posts: v.number(), visual: v.string() })), JSON.parse(output));
  expect(rows.map(({ type, turns, posts }) => ({ type, turns, posts }))).toEqual(
    ['H', 'S'].flatMap(type => [0, 1, 2, 3].map(turns => ({ type, turns, posts: type === 'H' ? 448 : 2560 }))),
  );
  // Original rendered positions/normals/colours/UVs; collision additions cannot change the view.
  expect(rows.map(row => row.visual)).toEqual([
    "c760bd53c77bc9c1d328c7a8c4f801f504e1d8a312513341a8af169058358f8a",
    "1156a2c989cf9d8224fe1c9fdea13dddc996680916fb849c035c61ee9f0cff9d",
    "3c8f2bbb0c9bf161a2afdcd28a94bf506e2d6d369cd2bdde1b966c8629178f76",
    "d0bef411ab7ba70d3fd1d70d6263726cb015d8b5e23ac2621d6baa5b189cee73",
    "97421f31cef598977201adf31b812a3894d0d208f13c64280485b39aa8813f59",
    "5e40e606929d37c71ad68e78e5fdc3c1e3f7e9b4d5f4673b61635d38b0405349",
    "15d7b40d58a32ba262c98c4dcd8b8f8f41905ea97f069bd0c6e613c739dfef94",
    "397ce51b1e4234db53d573bfbe79ce5b3e634da691922d25b1d8475fb1f398cf"
]);
});
