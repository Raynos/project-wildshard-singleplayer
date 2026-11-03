// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Frostline Peaks adds its lodge courts and pine woods to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const frost = new URL('../src/shards/open-plots/generators/frost.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {frostlineBuilders,frostlinePlot,liftPlacements} from ${JSON.stringify(frost)};
const letters={N:'forecourt',P:'plaza',G:'garden'},builders=frostlineBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['D','F','G','N','P']);
// OB3 round 1: Frostline draws its own L1 stand-ins (snow-tipped cones, white gables), not the generic coarse box
assert.ok(!builders.coarseFamilies.has('lodges')&&!builders.coarseFamilies.has('pines'));
assert.equal(builders.seam.name,'frostLane','its own lantern-post lanes, not the string lights and banners');
assert.throws(()=>frostlineBuilders({D:'garden'}),/theme tile/);
// a mirror-symmetric draft: every row reads the same from either end, the south half the north turned twice
const rows=['F0 D0 F0 N0 N3 F0 D0 F0','D0 F0 G0 D0 D0 G0 F0 D0','F0 G0 D1 F0 F0 D3 G0 F0','N2 D0 F0 P0 P1 F0 D0 N1',
  'N3 D2 F0 P3 P2 F0 D2 N0','F0 G0 D1 F0 F0 D3 G0 F0','D2 F0 G0 D2 D2 G0 F0 D2','F0 D2 F0 N1 N2 F0 D2 F0'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>64*20,'every tile draws its ground, drifts or stand-in pines');
assert.ok(tris('Glow')>0,'the lantern posts glow');
assert.ok(tris('far')>0&&parts.solid.part('Solid').positions.length>0);
assert.equal(frostlinePlot.builders({builders:letters}).tiles.F.sockets,'pppp');
const cable=new Soup(),lift=liftPlacements({stations:[[40,0,30],[8,54,6]],towers:[[30,10,22],[20,26,15],[12,42,9]],chairs:12},cable,[0.1,0.1,0.1]);
assert.deepEqual(lift.map(row=>row.variant).sort(),[0,0,0,...Array(12).fill(1),2,2],'two stations, three towers, twelve chairs');
assert.ok(lift.every(row=>row.at.every(Number.isFinite)&&Number.isFinite(row.yaw)));
assert.equal(cable.part('Kit').positions.length/9,2*4*4,'two cables of four spans, four triangles a span');
// a tower that gives its sheaves' height stands scaled to it, and the cable passes over it there
const tall=new Soup(),high=liftPlacements({stations:[[48,0,0],[16,60.1,0]],towers:[[21,38.8,0,22],[30,25.4,0],[38,11.8,0]],chairs:12},tall,[0.1,0.1,0.1]);
assert.deepEqual(high.filter(row=>row.variant===0).map(row=>+row.scale.toFixed(3)),[+(22/11.9).toFixed(3),1,1]);
assert.ok(high.filter(row=>row.variant===0).every(row=>row.at.length===3));
assert.ok(tall.part('Kit').positions.some((v,i)=>i%3===1&&Math.abs(v-(38.8+22))<0.1),'the cable rides the tall tower at 60.8 m');
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
