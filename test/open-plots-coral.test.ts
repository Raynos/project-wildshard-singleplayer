// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Coral Drift adds its hut lagoon, palm grove and reef pool to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const coral = new URL('../src/shards/open-plots/generators/coral.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,paving,Soup} from ${JSON.stringify(kit)};
import {coralDriftBuilders,coralDriftPlot} from ${JSON.stringify(coral)};
const letters={G:'garden',N:'forecourt',P:'plaza'},builders=coralDriftBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['B','G','M','N','P','R']);
assert.ok(builders.coarseFamilies.has('huts')&&builders.coarseFamilies.has('palms'));
assert.throws(()=>coralDriftBuilders({B:'garden'}),/theme tile/);
// a mirror-symmetric draft: every row reads the same from either end, the south half the north turned twice
const rows=['M0 B2 B2 N0 N3 B2 B2 M0','B1 R0 M0 R0 R0 M0 R0 B3','B1 M0 G0 R0 R0 G0 M0 B3','N2 R0 R0 P0 P1 R0 R0 N1',
  'N3 R0 R0 P3 P2 R0 R0 N0','B1 M0 G0 R0 R0 G0 M0 B3','B1 R0 M0 R0 R0 M0 R0 B3','M0 B0 B0 N1 N2 B0 B0 M0'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Water')>=2*36,'every pond draws its water');
assert.ok(tris('Glow')>=4*12,'the fallback lanterns glow');
assert.ok(tris('far')>0&&parts.solid.part('Solid').positions.length>0);
// the lagoons are cut from the boardwalk: no paved cell's middle lies in a theme tile's water
const ponds={B:[-26.25,-26.25,26.25,12],R:[-21,-21,21,21]};
for(const [x0,z0,x1,z1] of paving(grid,246.25,builders)){
  const tc=Math.floor(((x0+x1)/2+250)/62.5),tr=Math.floor((250-(z0+z1)/2)/62.5),tile=grid[tr]?.[tc];
  if(tile===undefined||!(tile.type in ponds)||(tile.type==='B'&&tile.turns!==0))continue;
  const lx=(x0+x1)/2-(-250+62.5*(tc+0.5)),lz=(z0+z1)/2-(250-62.5*(tr+0.5)),[a,b,c,d]=ponds[tile.type];
  assert.ok(!(lx>a&&lx<c&&lz>b&&lz<d),'paving over a pond at '+tile.type);
}
assert.equal(coralDriftPlot.builders({builders:letters}).tiles.B.sockets,'pppp');
assert.equal(coralDriftPlot.ringInKit,true);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
