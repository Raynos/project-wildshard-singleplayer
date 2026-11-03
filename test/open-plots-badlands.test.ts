// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Fossil Badlands adds its mesa, camp, trench, sump and fossil tiles to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const dig = new URL('../src/shards/open-plots/generators/badlands.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/fossil-badlands.json', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,paving,Soup} from ${JSON.stringify(kit)};
import {fossilBadlandsBuilders,fossilBadlandsPlot} from ${JSON.stringify(dig)};
const layout=JSON.parse(readFileSync(new URL(${JSON.stringify(layout)}),'utf8')),builders=fossilBadlandsBuilders(layout.builders);
assert.deepEqual(Object.keys(builders.tiles).sort(),['A','D','F','M','N','P','W']);
assert.ok(builders.coarseFamilies.has('dig'));
assert.throws(()=>fossilBadlandsBuilders({M:'garden'}),/theme tile/);
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
const letters=row=>row.split(' ').map(t=>t[0]).join('');
for(const [r,row] of layout.rows.entries()){assert.equal(letters(row),[...letters(row)].reverse().join(''));assert.equal(letters(row),letters(layout.rows[7-r]));}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0,'the pits, mesas and bones draw near and far');
assert.ok(tris('Water')>0,'the sumps hold water');
assert.ok(parts.solid.part('Solid').positions.length>0,'fences, mesas and lamps collide');
// the paving leaves every pit open: no paved cell inside a trench tile's pit
const pits=paving(grid,250,builders).filter(([x0,z0,x1,z1])=>{const cx=(x0+x1)/2,cz=(z0+z1)/2,lx=((cx%62.5)+62.5)%62.5-31.25,lz=((cz%62.5)+62.5)%62.5-31.25;return Math.abs(lx)<15&&Math.abs(lz)<11;});
assert.equal(pits.filter(([x0,z0,x1,z1])=>{const c=Math.floor((x0+x1)/2/62.5+4),r=Math.floor(4-(z0+z1)/2/62.5);return 'DWF'.includes(grid[r][c].type);}).length,0);
assert.equal(fossilBadlandsPlot.builders(layout).tiles.M.sockets,'pppp');
assert.equal(fossilBadlandsPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
