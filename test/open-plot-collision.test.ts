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
    "a36effb22705ac4715fdea5b999dcd11941cec0c4b1071c43e907cb87a44e442",
    "75afee0137650e282a35fd02893eee68093e00da684c1e922d2d2cd000842d02",
    "d9a6c3c7c05abbf9470bf3c255910adbea1ab24f340a8c8a92c3bd5851a6aa98",
    "d3a96c590a753a89be5d1ebc0d77679715660f84233d0c3ef8744dc35615948f",
    "caf4de2ce1e5bb51590a744e3ffe5cc4967c92d6b613fdc816f3f287866a8fdd",
    "5a7a1b014a60d00c48c8ceaf9c96348bc33c9ea13b095783d09dbe414ac1a94b",
    "f9f877c3f4f4651ff302ef212c542d711b251bd44fa43b7a899c22aba96b27f8",
    "6267b5dd6398c80a3fe1baa782eab58af1bb69c232fea941ac1f75636b39c228"
]);
});
