// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the build-only plot builders in their native Node environment.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('Lantern Bayou adds its stilt and marsh ponds to the shared letters on the plot core', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const bayou = new URL('../src/shards/open-plots/generators/bayou.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {buildLayout,parseLayout,paving,Soup} from ${JSON.stringify(kit)};
import {lanternBayouBuilders,lanternBayouPlot} from ${JSON.stringify(bayou)};
const letters={G:'garden',N:'forecourt',P:'plaza'},builders=lanternBayouBuilders(letters);
assert.deepEqual(Object.keys(builders.tiles).sort(),['G','N','P','T','W']);
assert.ok(builders.coarseFamilies.has('stilts'));
assert.throws(()=>lanternBayouBuilders({T:'garden'}),/theme tile/);
// a mirror-symmetric draft: every row reads the same from either end, the south half the north turned twice
const rows=['T0 W0 G0 N0 N3 G0 W0 T0','W0 T0 W0 G0 G0 W0 T0 W0','G0 W0 T1 W0 W0 T3 W0 G0','N2 G0 W0 P0 P1 W0 G0 N1',
  'N3 G0 W0 P3 P2 W0 G0 N0','G0 W0 T1 W0 W0 T3 W0 G0','W0 T2 W0 G0 G0 W0 T2 W0','T2 W0 G0 N1 N2 G0 W0 T2'];
const grid=parseLayout(rows,builders);
const parts=new Proxy({},{get:(target,name)=>(target[name]??=new Soup())});
const grey=new Proxy({},{get:()=>[0.5,0.5,0.5]});
buildLayout(grid,parts,grey,(r,c)=>(r*7+c*3)%2,undefined,builders);
const tris=name=>parts[name].part(name).positions.length/9;
assert.ok(tris('Water')>=2*36,'every pond draws its water');
assert.ok(tris('Glow')>=4*(12+20),'fireflies and the fallback lanterns glow');
assert.ok(tris('far')>0&&parts.solid.part('Solid').positions.length>0);
// the ponds are cut from the boardwalk: no paved cell's middle lies in a theme tile's pond
const ponds=[[-26.25,-26.25,26.25,12],[-21,-21,21,21]];
for(const [x0,z0,x1,z1] of paving(grid,246.25,builders)){
  const tc=Math.floor(((x0+x1)/2+250)/62.5),tr=Math.floor((250-(z0+z1)/2)/62.5),tile=grid[tr]?.[tc];
  if(tile===undefined||(tile.type!=='W'&&tile.turns!==0)||tile.type==='G'||tile.type==='N'||tile.type==='P')continue;
  const lx=(x0+x1)/2-(-250+62.5*(tc+0.5)),lz=(z0+z1)/2-(250-62.5*(tr+0.5)),[a,b,c,d]=ponds[tile.type==='T'?0:1];
  assert.ok(!(lx>a&&lx<c&&lz>b&&lz<d),'paving over a pond at '+tile.type);
}
assert.equal(lanternBayouPlot.builders({builders:letters}).tiles.T.sockets,'pppp');
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});

test('no committed open-plot kit or layout carries a negative zero (the world preflight refuses -0)', () => {
  const program = `import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const minus=(v,at)=>{if(typeof v==='number')assert.ok(!Object.is(v,-0),'-0 at '+at);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))minus(x,at+'.'+k);};
const kit='public/assets/open-plots/kit/',layouts='src/shards/open-plots/data/layouts/';
for(const name of readdirSync(kit).filter(n=>n.endsWith('.glb'))){
  const b=readFileSync(kit+name),length=b.readUInt32LE(12);
  assert.equal(b.readUInt32LE(16),0x4e4f534a);minus(JSON.parse(b.subarray(20,20+length).toString('utf8')),name);
}
for(const name of readdirSync(layouts).filter(n=>n.endsWith('.json')))minus(JSON.parse(readFileSync(layouts+name,'utf8')),name);
console.log('ok');`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('ok');
});
