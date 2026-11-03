// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Floating Island Race adds its track, paddock, garage and stand tiles to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const circuit = new URL('../src/shards/open-plots/generators/skyrace.mjs', import.meta.url).href;
  const layout = new URL('../src/shards/open-plots/data/layouts/sky-race.json', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {skyRaceBuilders,skyRacePlot} from ${JSON.stringify(circuit)};
const layout=JSON.parse(readFileSync(new URL(${JSON.stringify(layout)}),'utf8')),builders=skyRaceBuilders(layout.builders);
assert.deepEqual(Object.keys(builders.tiles).sort(),['A','K','N','P','R','T']);
assert.ok(builders.coarseFamilies.has('race'));
assert.throws(()=>skyRaceBuilders({T:'garden'}),/theme tile/);
// mirror-symmetric: every row reads the same letters from either end, the south half the north's
const letters=row=>row.split(' ').map(t=>t[0]).join('');
for(const [r,row] of layout.rows.entries()){assert.equal(letters(row),[...letters(row)].reverse().join(''));assert.equal(letters(row),letters(layout.rows[7-r]));}
const grid=parseLayout(layout.rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0,'the circuits, paddocks and stands draw near and far');
assert.ok(tris('Water')>0,'the circuit ponds hold water');
assert.ok(parts.solid.part('Solid').positions.length>0,'cars, garages, flags and lamps collide');
// by day: no shared-builder firefly (Glow with no green or blue, red under 0.5) reaches a circuit tile
const glow=parts.Glow.part('Glow');
for(let i=0;i<glow.colours.length;i+=3)assert.ok(!(glow.colours[i+1]===0&&glow.colours[i+2]===0&&glow.colours[i]<0.5),'a firefly drew by day');
assert.equal(skyRacePlot.builders(layout).tiles.T.sockets,'pppp');
assert.equal(skyRacePlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
