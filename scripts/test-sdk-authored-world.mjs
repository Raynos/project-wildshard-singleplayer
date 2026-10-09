#!/usr/bin/env node
// SF55a: an ordinary Blender world builds and walks with only Node and the installed SDK tarball.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..'), scratch = mkdtempSync(join(tmpdir(), 'sf55a-tarball-'));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function hashes(directory) {
  return readdirSync(directory).sort().map(name => [name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')]);
}
try {
  run('pnpm', ['--dir', 'src/sdk', 'pack', '--pack-destination', scratch]);
  const tarball = join(scratch, 'wildshard-sdk-0.0.0.tgz'), consumer = join(scratch, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@wildshard/sdk': `file:${tarball}` } }));
  run('pnpm', ['install', '--ignore-scripts', '--config.enableGlobalVirtualStore=false'], consumer);
  const cli = join(consumer, 'node_modules/.bin/wildshard'), project = join(consumer, 'world');
  run(cli, ['new', project], consumer);
  cpSync(join(root, 'test/fixtures/sdk-authored-world/world.glb'), join(project, 'assets/world.glb'));
  cpSync(join(root, 'test/fixtures/sdk-authored-world/door.as'), join(project, 'behaviour/door.as'));
  writeFileSync(join(project, 'shard.config.ts'), `import { emptyShardfile } from '@wildshard/sdk/author';
const shard = emptyShardfile({slug:'blender-fixture',name:'Blender fixture',author:'Wildshard',revision:1,seed:55});
export const behaviour = [{id:'door', source:'behaviour/door.as', maximumPages:2}];
export default {...shard,
  sim:{...shard.sim,scriptTickDivisor:1,scripts:['script:door'],bindings:[{module:'script:door',entity:1106943697,actorId:'actor.player',kind:'server'}]},
  state:{...shard.state,shared:[{id:101,name:'door.open',type:'bool',privacy:'public',default:false}]},
  hooks:{conditions:[],scenes:[{id:'door.toggle',type:201,value:1}]},
  targets:{panels:[{panel:'hall.door',scope:'shared',fieldId:101,equals:1,visibleWhenMatched:false,colliders:['hall.door.collider'],activeWhenMatched:false}],interactions:[{id:'door.use',at:[10,1.5,15],radius:3,label:'Open door',scene:'door.toggle'}]},
  spawn:{x:0,y:0.1,z:0,yaw:0}, world:{glb:'assets/world.glb',materials:{Clay:'pbr',Paint:'pbr','Door wood':'pbr'},colliders:'mesh',objects:{Bridge:'bridge'},interactive:[{node:'Door',id:'hall.door',colliderId:'hall.door.collider'}]}};
`);
  const first = join(consumer, 'first'), second = join(consumer, 'second');
  const build = run(cli, ['build', project, first, '--product-only'], consumer);
  run(cli, ['build', project, second, '--product-only'], consumer);
  if (JSON.stringify(hashes(first)) !== JSON.stringify(hashes(second))) throw new Error('Authored SDK products differ byte-for-byte');
  const validation = run(cli, ['validate', join(first, 'shard.json')], consumer);
  if (!validation.includes('92 edge lanes')) throw new Error('Authored SDK fixture did not prove all entry lanes');
  const shard = JSON.parse(readFileSync(join(first, 'shard.json'), 'utf8'));
  if (shard.meshCollision.panels.length !== 1 || shard.props.panels.length !== 1 || shard.files.filter(row => row.kind === 'ktx2').length !== 2) throw new Error('Door/texture transport missing');
  writeFileSync(join(consumer, 'verify.mjs'), `import {readFileSync} from 'node:fs';
import {HeadlessSimulation} from '@wildshard/sdk/headless';
const product=JSON.parse(readFileSync(${JSON.stringify(join(first, 'shard.json'))},'utf8'));
const assets=new Map(product.files.map(file=>[file.hash,new Uint8Array(readFileSync(${JSON.stringify(first)}+'/'+file.hash))]));
const host=await HeadlessSimulation.create(product,assets);
try {
  const shared=commit=>JSON.parse(JSON.parse(commit.snapshot).snapshot.adapters.find(row=>row.id==='script.declared').state).world.shared[0];
  if(shared(await host.step())!==0) throw Error('Door starts open');
  for(const expected of [1,0]) {
    let commit=await host.step([{source:'door',commands:[{kind:'event',type:201,target:1106943697,value:1}]}]);
    for(let tick=0;tick<3;tick++) commit=await host.step();
    if(shared(commit)!==expected) throw Error('Compiled door did not toggle');
  }
} finally {await host.dispose();}
console.log('compiled door toggles open and closed');
`);
  const gameplay = run('node', ['verify.mjs'], consumer).trim();
  const receipt = { pass: true, tarballBytes: statSync(tarball).size, installedBy: 'file:', identicalBuilds: 2, files: hashes(first).length,
    textures: 2, interactivePanels: 1, compiledScripts: shard.sim.scripts.length, gameplay, collisionTiles: shard.meshCollision.tiles.length, renderTiles: shard.tiles.length,
    build: build.trim(), validation: validation.trim() };
  const output = process.argv.at(2); if (output !== undefined) { mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`); }
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (error !== null && typeof error === 'object' && 'stdout' in error) process.stderr.write(String(error.stdout));
  if (error !== null && typeof error === 'object' && 'stderr' in error) process.stderr.write(String(error.stderr));
  throw error;
} finally { rmSync(scratch, { recursive: true, force: true }); }
