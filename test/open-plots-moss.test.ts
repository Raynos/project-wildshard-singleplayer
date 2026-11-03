// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Mosslight Ruins adds its ruin courts and emerald pools to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const moss = new URL('../src/shards/open-plots/generators/mosslight.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {mosslightBuilders,mosslightPlot,towerWindows} from ${JSON.stringify(moss)};
const letters={N:'forecourt',P:'plaza',G:'garden'},builders=mosslightBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['E','G','N','P','R']);
assert.ok(builders.coarseFamilies.has('ruins')&&builders.coarseFamilies.has('rubble'));
assert.throws(()=>mosslightBuilders({R:'garden'}),/theme tile/);
// a mirror-symmetric draft: every row reads the same from either end, the south half the north turned twice
const rows=['R0 R0 G0 N0 N3 G0 R1 R1','R0 E0 E0 G0 G0 E1 E1 R1','G0 E0 R0 G0 G0 R1 E1 G0','N2 G0 G0 P0 P1 G0 G0 N1',
  'N3 G0 G0 P3 P2 G0 G0 N0','G0 E2 R2 G0 G0 R3 E3 G0','R2 E2 E2 G0 G0 E3 E3 R3','R2 R2 G0 N1 N2 G0 R3 R3'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>64*20,'every tile draws its ground, coping or stand-in trees');
assert.ok(tris('Water')>=16*2,'every emerald pool has its water');
assert.ok(tris('Glow')>0,'the lamps and the motes glow');
assert.ok(tris('far')>0&&parts.solid.part('Solid').positions.length>0);
assert.equal(mosslightPlot.builders({builders:letters}).tiles.E.sockets,'pppp');
// the tower's slits: one emerald quad each, scaled with the tower and turned with it
const glow=new Soup(),rowsW=[[0,10,-4.7,0,1,1,1.5],[4.7,20,0,1,0,1,1.5]];
towerWindows(glow,{height:70,turn:1,windows:rowsW},[0.1,1,0.3]);
const pane=glow.part('Glow').positions;
assert.equal(pane.length/9,4,'two panes, two triangles each');
const ys=[];for(let i=1;i<pane.length;i+=3)ys.push(pane[i]);
assert.ok(Math.min(...ys)>=10*2-1.5-1e-9&&Math.max(...ys)<=20*2+1.5+1e-9,'the panes scale with a 70 m tower');
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
