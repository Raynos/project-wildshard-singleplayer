// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Starfall Observatory builds its stargazer gardens beside the shared letters', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const starfall = new URL('../src/shards/open-plots/generators/starfall.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/starfall-observatory.json', import.meta.url).pathname;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {starfallBuilders,starfallPlot} from ${JSON.stringify(starfall)};
const layout=JSON.parse(readFileSync(${JSON.stringify(layout)},'utf8'));
const builders=starfallBuilders(layout.builders);
assert.deepEqual(Object.keys(builders.tiles).sort(),['C','G','H','L','N','P','V']);
assert.ok(builders.coarseFamilies.has('stars'));
assert.throws(()=>starfallBuilders({V:'garden'}),/theme tile/);
assert.equal(layout.plot,'starfall-observatory');
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
for(const row of layout.rows){const letters=row.split(' ').map(c=>c[0]);assert.deepEqual(letters,[...letters].reverse());}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0&&tris('Water')>0,'the paving, canals and stand-ins draw near and far');
assert.ok(parts.solid.part('Solid').positions.length>0,'houses, lamps and the gardens collide');
assert.equal(starfallPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
