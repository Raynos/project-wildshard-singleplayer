// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Frostline Peaks adds its lodge courts and pine woods to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const frost = new URL('../src/shards/open-plots/generators/frost.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {frostlineBuilders,frostlinePlot} from ${JSON.stringify(frost)};
const letters={N:'forecourt',P:'plaza',G:'garden'},builders=frostlineBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['D','F','G','N','P']);
assert.ok(builders.coarseFamilies.has('lodges')&&builders.coarseFamilies.has('pines'));
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
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
