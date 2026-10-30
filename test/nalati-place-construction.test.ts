// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native CLI without publishing fixture outputs.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import * as v from 'valibot';

const native = ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs'];
const shard = '--generation-shard=nalati-grasslands';

test('fresh native POI keep-outs own their rows without selecting a world or retaining geometry', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { BufferGeometry } from 'three';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { readNativeTerrain } from './src/sdk/bake/terrain.ts';
    import { bakeNalatiPoiKeepouts } from './src/shards/nalati-grasslands/generators/places.ts';
    assert.equal(selectedLevel(),null);
    const ground=readNativeTerrain(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
    const prior=BufferGeometry.prototype.dispose;let disposed=0;
    BufferGeometry.prototype.dispose=function(){disposed++;return prior.call(this);};
    try{
      const made=bakeNalatiPoiKeepouts(ground.heightAt),next=bakeNalatiPoiKeepouts(ground.heightAt);
      assert.ok(made.length>0);assert.ok(disposed>0);
      assert.deepEqual(made,next);assert.notEqual(made,next);
      for(let i=0;i<made.length;i++)assert.notEqual(made[i].colliders,next[i].colliders);
      assert.equal(selectedLevel(),null);
    }finally{BufferGeometry.prototype.dispose=prior;}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});

test('native dressing preparation does not read the old generated place rows', () => {
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const prior=fs.readFileSync;
    fs.readFileSync=(path,...options)=>{
      const file=String(path).replaceAll('\\\\','/');
      if(file.includes('/out/') || file.includes('/wildshard/shardfiles/')) throw new Error('Unexpected built-product input');
      if(file.endsWith('/nalati-grasslands/data/places.json'))
        throw new Error('Unexpected generated POI preparation input');
      return prior(path,...options);
    };
    syncBuiltinESMExports();
    try{
      const { prepareNalatiDressing }=await import('./scripts/bake/nalatiDressing.mjs');
      const {originalGeographyFiles}=await import('./test/fixtures/nalati-geography-original.ts');
      const made=await prepareNalatiDressing(undefined,originalGeographyFiles());
      assert.equal(made.plan.stumps.length,10);assert.ok(made.avoid>0);
    }finally{fs.readFileSync=prior;syncBuiltinESMExports();}
  `;
  execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source, '--', shard]);
});

test('the retired dressing CLI refuses publication rather than rebuilding handoff files', () => {
  expect(()=>execFileSync(process.execPath, ['--experimental-transform-types','--import','./scripts/bake-loader.mjs',
    'scripts/bake/nalatiDressing.mjs','src/shards/nalati-grasslands/generators/dressingPlan.ts',shard,'--check'])).toThrow('Nalati dressing publication is retired');
});

test('continuous forest decisions retain the original static stump lost by the bilinear mask', () => {
  const source = `
    import { prepareNalatiDressing } from './scripts/bake/nalatiDressing.mjs';
    import {originalGeographyFiles} from './test/fixtures/nalati-geography-original.ts';
    import { inSpruceClearing, loneSpruceMask, edgeBermAt } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import { edgeSpruceMask } from './src/shards/nalati-grasslands/generators/edgeRecipe.ts';
    const runtime = await prepareNalatiDressing(undefined,originalGeographyFiles());
    const original = await prepareNalatiDressing((x,z) => inSpruceClearing(x,z) ? 0 : Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z))),originalGeographyFiles());
    console.log(JSON.stringify({ runtime: runtime.plan.stumps.length, original: original.plan.stumps.length }));
  `;
  const output = execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source, '--', shard], { encoding: 'utf8' });
  const counts = v.parse(v.strictObject({ runtime: v.number(), original: v.number() }), JSON.parse(output));
  expect(counts).toEqual({ runtime: 10, original: 11 });
});

test('owned outcrops use only supplied queries without an active level', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { outcropsPlace } from './src/shards/nalati-grasslands/generators/places.ts';
    assert.equal(selectedLevel(),null);
    let normals=0,trails=0;
    const noop=()=>undefined;
    const steps=outcropsPlace({ground:()=>0,flutter:{streamer:noop,flag:noop,strip:noop},smoke:{emitter:noop}},{
      normalAt:(_x,_z,epsilon)=>{assert.equal(epsilon,1.5);normals++;return [0,1,0];},
      trailDistance:()=>{trails++;return Infinity;},
    });
    let step=steps.next();while(!step.done)step=steps.next();
    assert.ok(normals>0);assert.ok(trails>0);
    assert.equal(step.value.name,'outcrops');
    for(const mesh of step.value.meshes)mesh.geometry.dispose();
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});

test('native places refuse omitted terrain queries before constructing geometry', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { bakeNalatiPlaces } from './src/shards/nalati-grasslands/generators/places.ts';
    assert.equal(selectedLevel(),null);
    assert.throws(()=>bakeNalatiPlaces(()=>{throw new Error('Unexpected ground access');}),/Native places require explicit terrain queries/);
    assert.equal(selectedLevel(),null);
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});

test('native crags keep all registered bytes without selecting a level', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { bakeCragRockOnTerrain } from './src/shards/nalati-grasslands/generators/places.ts';
    assert.equal(selectedLevel(),null);
    assert.throws(()=>bakeCragRockOnTerrain(false,new Uint8Array()),/Native terrain byte cap/);
    await import('./scripts/bake-nalati-crags.mjs');
    assert.equal(selectedLevel(),null);
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source, '--', '--check']);
});

test('native dressing rock keep-outs own their geometry and require no selected level', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { BufferGeometry } from 'three';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { readNativeTerrain } from './src/sdk/bake/terrain.ts';
    import { dressingRockColliders } from './src/shards/nalati-grasslands/generators/places.ts';
    import { TERRAIN } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    assert.equal(selectedLevel(),null);
    const native=readNativeTerrain(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
    const queries={normalAt:native.normalAt,trailDistance:TERRAIN.trailDistance};
    const original=BufferGeometry.prototype.dispose, disposed=new Set();
    BufferGeometry.prototype.dispose=function(){disposed.add(this);return original.call(this);};
    try{
      const first=dressingRockColliders(native.heightAt,false,queries);
      assert.ok(first.length>0);assert.ok(disposed.size>0);
      const before=JSON.stringify(first),count=disposed.size;
      const second=dressingRockColliders(native.heightAt,false,queries);
      assert.equal(JSON.stringify(second),before);assert.ok(disposed.size>count);
      assert.notEqual(first,second);assert.notEqual(first[0],second[0]);
      first[0].x+=1;assert.equal(JSON.stringify(second),before);
      assert.equal(selectedLevel(),null);
    }finally{BufferGeometry.prototype.dispose=original;}
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
});
