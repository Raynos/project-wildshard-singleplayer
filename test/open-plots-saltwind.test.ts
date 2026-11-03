// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Saltwind Lighthouse builds its harbour tiles alone on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const harbour = new URL('../src/shards/open-plots/generators/saltwind.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/saltwind-lighthouse.json', import.meta.url).pathname;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {saltwindBuilders,saltwindPlot} from ${JSON.stringify(harbour)};
const builders=saltwindBuilders();
assert.deepEqual(Object.keys(builders.tiles).sort(),['B','C','N','P','R']);
assert.ok(builders.coarseFamilies.has('harbour'));
const layout=JSON.parse(readFileSync(${JSON.stringify(layout)},'utf8'));
assert.equal(layout.plot,'saltwind-lighthouse');
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
for(const row of layout.rows){const letters=row.split(' ').map(c=>c[0]);assert.deepEqual(letters,[...letters].reverse());}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0&&tris('Water')>0,'the quays, basins and stand-ins draw near and far');
assert.ok(parts.solid.part('Solid').positions.length>0,'bollards, lamps and boats collide');
// a storm, not a market: no shared-builder firefly (Glow with no green or blue, red under 0.5)
const glow=parts.Glow.part('Glow');
for(let i=0;i<glow.colours.length;i+=3)assert.ok(!(glow.colours[i+1]===0&&glow.colours[i+2]===0&&glow.colours[i]<0.5),'a firefly drew');
assert.equal(saltwindPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
