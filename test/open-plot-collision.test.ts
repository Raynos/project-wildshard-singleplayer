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
    "f621c67fe740064a73e443316b99cc6303e8eac30917b86745497340f655d08e",
    "0973db352e3c477c5a09630dd8de83fc7d599504de2ad2f73063873caf8c1075",
    "9a3bfba9b1367d1153e06b6f875b93367b5e31b1b5b516c329b56adbb05b97d7",
    "21ecef97f7b7874109c39df1ca23cd9bb994103046ed23fcab9787b11ee7e63a",
    "b8da87f85b1c396c30fd460ad7bcdc22bf821fd13f80a64f44c353655654a5b0",
    "edfe9752bc2b202bf551983dd108f562c9c7ea21df26e73debf1f00dc43275eb",
    "52bb5dcbdbe2dde8da935924913683d2746bd6707b42d0972b5ae34f42a34c04",
    "b30e1c3deba88974c9f722ee57e3c423a165e0fc95d0974b811a489a7fb28f48"
]);
});
