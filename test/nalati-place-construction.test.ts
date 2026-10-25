// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native CLI without publishing fixture outputs.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify all four shipped native wire files independently.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as v from 'valibot';
import before from './fixtures/nalati-place-wires.json' with { type: 'json' };

const native = ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs'];
const shard = '--generation-shard=nalati-grasslands';

test('fresh native places retain exact binaries and the original native metadata contract', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { deflateSync } from 'node:zlib';
    import { nativeNalatiPlaces } from './src/shards/nalati-grasslands/generators/bake-nalati-painted.mjs';
    import { encodeNalatiPart } from './src/shards/nalati-grasslands/generators/placeWire.ts';
    import { alike } from './src/shards/nalati-grasslands/generators/bake-nalati-places.mjs';
    import { hashImmutableBytes } from './src/sdk/immutable.ts';
    const made = await nativeNalatiPlaces();
    const pins = JSON.parse(readFileSync('test/fixtures/nalati-place-wires.json','utf8'));
    for (const [name,document] of [['places','places.json'],['specimens','placeSpecimens.json']]) {
      const encoded = encodeNalatiPart(made[name],bytes => deflateSync(bytes,{level:9}));
      const pin = pins.find(row => row.path === 'public/assets/nalati/baked/'+name+'.bin');
      assert.equal(encoded.binary.byteLength,pin.bytes);assert.equal(hashImmutableBytes(encoded.binary),pin.hash);
      const original = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/'+document,'utf8'));
      const actual = JSON.parse(new TextDecoder().decode(encoded.document));
      // Retained native metadata has always compared all rows at 1e-9:
      // V8's final double bits differ between arm64 and x64. Geometry remains
      // bit-exact above, and the committed JSON wire pins remain exact below.
      assert.equal(alike(original,actual,name,()=>false),null);
      assert.notEqual(alike(original,{...actual,rows:actual.rows.slice(1)},name,()=>false),null);
      console.info(JSON.stringify({name,nativeDoubleDifference:alike(original,actual,name,()=>false,0)}));
    }
  `;
  execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source, '--', shard]);
  for (const expected of before.slice(0, 4)) {
    const bytes = readFileSync(expected.path);
    expect({ path: expected.path, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(expected);
  }
});

test('the independent runtime scatter plan keeps every existing output byte', () => {
  execFileSync(process.execPath, [...native, 'scripts/bake/nalatiDressing.mjs', 'src/shards/nalati-grasslands/generators/dressingPlan.ts', shard, '--check']);
});

test('continuous forest decisions retain the original static stump lost by the bilinear mask', () => {
  const source = `
    import { prepareNalatiDressing } from './scripts/bake/nalatiDressing.mjs';
    import { dressingRecipe } from './src/shards/nalati-grasslands/generators/dressingPlan.ts';
    import { inSpruceClearing, loneSpruceMask, edgeBermAt } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import { edgeSpruceMask } from './src/shards/nalati-grasslands/generators/edgeRecipe.ts';
    const runtime = await prepareNalatiDressing(dressingRecipe);
    const original = await prepareNalatiDressing(dressingRecipe, (x,z) => inSpruceClearing(x,z) ? 0 : Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z))));
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
    await import('./src/shards/nalati-grasslands/generators/bake-crag-rock.mjs');
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
