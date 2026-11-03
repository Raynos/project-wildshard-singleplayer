// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Sky Harbor adds its basin, quay and cottage tiles to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const harbor = new URL('../src/shards/open-plots/generators/skyharbor.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/sky-harbor.json', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {skyHarborBuilders,skyHarborPlot} from ${JSON.stringify(harbor)};
const layout=JSON.parse(readFileSync(new URL(${JSON.stringify(layout)}),'utf8')),builders=skyHarborBuilders(layout.builders);
assert.deepEqual(Object.keys(builders.tiles).sort(),['B','K','N','P','Q']);
assert.ok(builders.coarseFamilies.has('skyport')&&builders.coarseFamilies.has('harbour'));
assert.throws(()=>skyHarborBuilders({B:'garden'}),/theme tile/);
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
const letters=row=>row.split(' ').map(t=>t[0]).join('');
for(const [r,row] of layout.rows.entries()){assert.equal(letters(row),[...letters(row)].reverse().join(''));assert.equal(letters(row),letters(layout.rows[7-r]));}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0,'the quays, jetties and planters draw near and far');
assert.ok(tris('Water')>0,'the basins hold water');
assert.ok(parts.solid.part('Solid').positions.length>0,'planters, lamps and the basins collide');
// by day: no shared-builder firefly (Glow with no green or blue, red under 0.5) reaches a harbour tile
const glow=parts.Glow.part('Glow');
for(let i=0;i<glow.colours.length;i+=3)assert.ok(!(glow.colours[i+1]===0&&glow.colours[i+2]===0&&glow.colours[i]<0.5),'a firefly drew by day');
assert.equal(skyHarborPlot.builders(layout).tiles.B.sockets,'pppp');
assert.equal(skyHarborPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
