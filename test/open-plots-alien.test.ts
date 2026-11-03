// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Pastel Alien Plain builds its crystal beds, outcrops and dome habitats beside the shared letters', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const alien = new URL('../src/shards/open-plots/generators/alien.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/alien-plain.json', import.meta.url).pathname;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {alienBuilders,alienPlot} from ${JSON.stringify(alien)};
const layout=JSON.parse(readFileSync(${JSON.stringify(layout)},'utf8'));
const builders=alienBuilders(layout.builders);
assert.deepEqual(Object.keys(builders.tiles).sort(),['B','D','N','P','R']);
assert.ok(builders.coarseFamilies.has('alien'));
assert.throws(()=>alienBuilders({B:'garden'}),/theme tile/);
assert.equal(layout.plot,'alien-plain');
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
for(const row of layout.rows){const letters=row.split(' ').map(c=>c[0]);assert.deepEqual(letters,[...letters].reverse());}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0,'the paving, beds and stand-ins draw near and far');
assert.ok(parts.solid.part('Solid').positions.length>0,'beds, domes, spires and lamps collide');
// bar 7: steady-glow motes (Glow with no green, red at least 0.5) drift over the beds
const glow=parts.Glow.part('Glow');
let motes=0;
for(let i=0;i<glow.colours.length;i+=3)if(glow.colours[i+1]===0&&glow.colours[i]>=0.5)motes++;
assert.ok(motes>0,'no motes drew');
assert.equal(alienPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
