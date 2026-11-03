// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Ember Forge adds its forge courts and ore yards to the shared letters, and lava runs in its canals', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const ember = new URL('../src/shards/open-plots/generators/ember.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {emberForgeBuilders,emberForgePlot} from ${JSON.stringify(ember)};
const letters={P:'plaza',C:'canal',L:'bend'},builders=emberForgeBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['C','F','L','O','P']);
assert.ok(builders.coarseFamilies.has('forges')&&builders.coarseFamilies.has('ore'));
assert.throws(()=>emberForgeBuilders({F:'plaza'}),/theme tile/);
// the shipped shape: a lava moat of canals and bends round the plaza, forge courts and ore yards outside it
const rows=['O0 F0 O0 F0 F1 O1 F1 O1','F0 O0 L0 C1 C1 L1 O1 F1','O0 F0 C0 O0 O1 C0 F1 O1','F0 O0 C0 P0 P1 C0 O1 F1',
  'F2 O2 C0 P3 P2 C0 O3 F3','O2 F2 C0 O2 O3 C0 F3 O3','F2 O2 L3 C1 C1 L2 O3 F3','O2 F2 O2 F2 F3 O3 F3 O3'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>64*20,'every tile draws its yard, walls or stand-ins');
assert.ok(tris('Water')>=12*2,'every canal and bend of the moat has its lava');
assert.ok(tris('Glow')>0,'the lane lamps and the sparks glow');
assert.ok(tris('Pool')>0,'the lamps light their pools and the stacks smoke');
assert.ok(tris('far')>0&&parts.solid.part('Solid').positions.length>0);
assert.equal(emberForgePlot.builders({builders:letters}).tiles.F.sockets,'pppp');
assert.equal(emberForgePlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
