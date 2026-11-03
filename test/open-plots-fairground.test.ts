// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Patchwork Fairground adds its quilt, carousel and big-top tiles to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const fair = new URL('../src/shards/open-plots/generators/fairground.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,Soup} from ${JSON.stringify(kit)};
import {patchworkFairgroundBuilders,patchworkFairgroundPlot} from ${JSON.stringify(fair)};
const letters={G:'garden',N:'forecourt',P:'plaza'},builders=patchworkFairgroundBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['G','K','N','P','Q','T']);
assert.ok(builders.coarseFamilies.has('fair'));
assert.throws(()=>patchworkFairgroundBuilders({Q:'garden'}),/theme tile/);
// a mirror-symmetric draft: every row reads the same from either end, the south half the north turned twice
const rows=['T2 Q0 Q1 N0 N3 Q1 Q0 T2','Q0 K0 Q2 Q1 Q1 Q2 K0 Q0','Q1 Q2 Q0 Q2 Q2 Q0 Q2 Q1','N2 Q1 Q2 P0 P1 Q2 Q1 N1',
  'N3 Q1 Q2 P3 P2 Q2 Q1 N0','Q1 Q2 Q0 Q2 Q2 Q0 Q2 Q1','Q0 K0 Q2 Q1 Q1 Q2 K0 Q0','T0 Q0 Q1 N1 N2 Q1 Q0 T0'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Kit')>0&&tris('far')>0,'the fields, hedges and bales draw near and far');
assert.ok(parts.solid.part('Solid').positions.length>0,'hedges, bales, rides and lamps collide');
// by day: no shared-builder firefly (Glow with no green or blue, red under 0.5) reaches a fair tile
const glow=parts.Glow.part('Glow');
for(let i=0;i<glow.colours.length;i+=3)assert.ok(!(glow.colours[i+1]===0&&glow.colours[i+2]===0&&glow.colours[i]<0.5),'a firefly drew by day');
assert.equal(patchworkFairgroundPlot.builders({builders:letters}).tiles.Q.sockets,'pppp');
assert.equal(patchworkFairgroundPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
