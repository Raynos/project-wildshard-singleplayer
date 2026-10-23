// oxlint-disable-next-line import/no-nodejs-modules -- Check the retained offline producer against committed data.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node binary as the test worker.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the producer's declared inputs alongside its real bake.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin original raw geometry bytes independently of the file names.
import { createHash } from 'node:crypto';
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { modelContext, type ModelPart } from '../src/engine/models/model';
import { SkyRig } from '../src/engine/world/skyRig';
import { pickupLook } from '../src/engine/world/interact/types';
import { coinModel } from '../src/game/loot/coinModel';
import { installPickupCatalogue, preparePickupCatalogue } from '../src/game/models/specimenCatalogue';
import { authoredPickups } from '../src/game/generators/pickups';
import data from '../src/game/data/pickupCatalogue.json' with { type: 'json' };

function sameGeometry(actual: THREE.BufferGeometry, expected: THREE.BufferGeometry): void {
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
  for (const [name, attribute] of Object.entries(expected.attributes)) {
    const restored = actual.getAttribute(name);
    expect(restored.array.constructor).toBe(attribute.array.constructor);
    expect(restored.itemSize).toBe(attribute.itemSize);
    expect(restored.normalized).toBe(attribute.normalized);
    const bytes = (array: THREE.TypedArray): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    expect(bytes(restored.array)).toEqual(bytes(attribute.array));
  }
  expect(actual.index).toEqual(expected.index);
  expect(actual.groups).toEqual(expected.groups);
  expect(actual.boundingBox).toEqual(expected.boundingBox);
  expect(actual.boundingSphere).toEqual(expected.boundingSphere);
}

it('covers every reachable seed in real table order without importing frozen callers', () => {
  const program = `import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier.includes('-legacy/'))throw new Error('Legacy pickup dependency: '+specifier);return next(specifier,context);}});
await import('./scripts/bake-pickups.mjs');`;
  const output = execFileSync(execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs',
    '--input-type=module', '--eval', program, '--', '--check'], { encoding: 'utf8' });
  // The producer traces Interactables.parts and its real cache, then compares every encoded output byte.
  const result: unknown = JSON.parse(output);
  expect(result).toMatchObject({ variants: 23, rawBytes: 370224, compressedBytes: 78685, encodedBytes: 0, legacyEncodedBytes: 104948 });
  const traceRow = v.object({ id: v.string(), kind: v.string(), parts: v.array(v.object({ key: v.string(), seed: v.number() })) });
  const { traces } = v.parse(v.object({ traces: v.record(v.string(), v.array(traceRow)) }), result);
  const row = (shard: string, id: string) => traces[shard]?.find(candidate => candidate.id === id)?.parts;
  expect(row('driftwood-isle', 'shard-lookout')).toEqual([{ key: 'shard', seed: 6787 }]);
  expect(row('driftwood-isle', 'glass-1')).toEqual([{ key: 'seaglass', seed: 6804 }]);
  expect(row('pine-hollow', 'pond-glass')).toEqual([{ key: 'seaglass', seed: 6786 }]);
  expect(row('pine-hollow', 'ridge-flint')).toEqual([{ key: 'flint', seed: 6787 }]);
  expect(row('pine-hollow', 'resin-1')).toEqual([{ key: 'resin', seed: 6789 }]);
  expect(row('pine-hollow', 'token-1')).toEqual([{ key: 'token', seed: 6790 }, { key: 'token-rim', seed: 6791 }]);
  expect(Object.keys(traces).sort()).toEqual(['driftwood-isle', 'pine-hollow']);
  const jobs = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), inputRoots: v.array(v.string()), outputs:v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8'))).jobs;
  const inputs = jobs.find(job => job.id === 'shared-pickups')?.inputRoots;
  if (inputs === undefined) throw new Error('Missing shared-pickups producer');
  expect(inputs.some(path => path.includes('-legacy/'))).toBe(false);
  expect(jobs.find(job=>job.id==='shared-pickups')?.outputs).toEqual(['src/game/data/pickupCatalogue.json',...data.geometries.map(geometry=>`public${geometry.file}`)]);
});

it('restores every prepared geometry byte and gives each owner independent arrays', () => {
  for (const row of data.geometries) {
    const authored = authoredPickups.find(look => look.parts.some(candidate => candidate.key === row.key));
    const recipe = authored?.parts.find(candidate => candidate.key === row.key);
    const part = pickupLook(authored?.id ?? '')?.parts.find(candidate => candidate.key === row.key);
    if (part === undefined || recipe === undefined) throw new Error(`Missing pickup recipe ${row.key}`);
    const actual = part.geometry(row.seed), expected = recipe.geometry(row.seed), second = part.geometry(row.seed);
    sameGeometry(actual, expected);
    expect(second.getAttribute('position').array).not.toBe(actual.getAttribute('position').array);
    actual.getAttribute('position').setX(0, 999);
    sameGeometry(second, expected);
    actual.dispose(); expected.dispose(); second.dispose();
  }
  const coin = coinModel(0xc01), recipe = authoredPickups.find(row => row.id === 'coin')?.parts[0];
  if (recipe === undefined) throw new Error('Missing authored coin');
  const expected = recipe.geometry(0xc01); sameGeometry(coin, expected); coin.dispose(); expected.dispose();
});

it('preserves visible specimen heights, lit/glow order, shadows and animation rows', () => {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const ctx = modelContext(sky);
  for (const row of authoredPickups) {
    const look = pickupLook(row.id);
    if (look === undefined) throw new Error(`Missing look ${row.id}`);
    expect({ batch: look.batch, lift: look.lift }).toEqual({ batch: row.batch, lift: row.lift });
    expect(look.parts.map(({ geometry: _geometry, ...part }) => part))
      .toEqual(row.parts.map(({ geometry: _geometry, ...part }) => part));
    const built = look.model.build(ctx, {}, new Rng(1));
    if (built instanceof THREE.Object3D) throw new Error('Pickups must retain their ordered batched parts');
    const parts: readonly ModelPart[] = built;
    expect(parts).toHaveLength(row.parts.length);
    for (const [i, part] of parts.entries()) {
      const source = row.parts[i];
      if (source === undefined) throw new Error('Missing specimen part');
      const expected = source.geometry().translate(0, row.lift, 0);
      sameGeometry(part.geometry, expected);
      expect(part.material instanceof THREE.MeshBasicMaterial).toBe(source.batch === 'glow');
      expect(part.castShadow === true).toBe(source.batch === 'lit');
      expect(part.receiveShadow === true).toBe(source.batch === 'lit');
      expected.dispose(); part.geometry.dispose();
    }
  }
});

it('refuses undeclared seeds and malformed declarations without a live fallback', () => {
  expect(() => pickupLook('seaglass')?.parts[0]?.geometry(1)).toThrow('No prepared pickup geometry');
  expect(() => coinModel(2)).toThrow('No prepared pickup geometry');
  expect(() => installPickupCatalogue({ ...data, geometries: [...data.geometries, data.geometries[0]] })).toThrow('Duplicate pickup declaration');
  expect(() => installPickupCatalogue({ ...data, geometries: data.geometries.filter(row => row.seed !== data.seed) })).toThrow('Missing pickup specimen geometry');
  expect(() => installPickupCatalogue({ ...data, callback: () => undefined })).toThrow('plain JSON data');
});


const pickupFiles=new Map(data.geometries.map(row=>[row.file,new Uint8Array(readFileSync(`public${row.file}`))]));
it('keeps the original ordered raw payload, source identities and geometry metadata',()=>{
  const all=createHash('sha256');let bytes=0;
  for(const row of data.geometries){
    const raw=pickupFiles.get(row.file);if(raw===undefined)throw new Error('Missing raw pickup');
    expect(row.file).toBe(`/assets/baked/common/pickups/${createHash('sha256').update(raw).digest('hex')}.bin`);
    all.update(raw);bytes+=raw.byteLength;
  }
  expect(bytes).toBe(370224);
  expect(all.digest('hex')).toBe('f7d3d060691377efa8aec3b4050b437fcfafc14a227b869d79fcbc91b226a5c6');
});

it('preflights the complete file bank before changing any existing pickup factory',()=>{
  const read=vi.fn((file:string)=>Promise.resolve(pickupFiles.get(file)??new Uint8Array()));
  const before=data.looks.map(row=>pickupLook(row.id));
  expect(()=>preparePickupCatalogue({file:read},{...data,geometries:[...data.geometries,data.geometries[0]]})).toThrow('Duplicate pickup declaration');
  expect(read).not.toHaveBeenCalled();
  const hostile={...data};let calls=0;Object.defineProperty(hostile,'looks',{enumerable:true,get:()=>{calls++;return data.looks;}});
  expect(()=>preparePickupCatalogue({file:read},hostile)).toThrow('plain JSON data');expect(calls).toBe(0);expect(read).not.toHaveBeenCalled();
  const wrong=new Map(pickupFiles),last=data.geometries.at(-1);if(last===undefined)throw new Error('Missing final pickup');
  wrong.set(last.file,new Uint8Array(1));
  expect(()=>installPickupCatalogue(data,wrong)).toThrow('Pickup source was not prepared');
  expect(data.looks.map(row=>pickupLook(row.id))).toEqual(before);
  for(const [i,row]of data.looks.entries())expect(pickupLook(row.id)).toBe(before[i]);
});

it('retiring an ancestor during a raw read refuses before later reads or installation',async()=>{
  const parent=new Scope('pickup-parent'),scope=parent.child('pickup-preparation');
  let finish:(bytes:Uint8Array)=>void=()=>undefined;
  const held=new Promise<Uint8Array>(resolve=>{finish=resolve;}),read=vi.fn(()=>held);
  const pending=preparePickupCatalogue({file:read},data,scope);expect(read).toHaveBeenCalledTimes(1);
  const first=data.geometries[0];if(first===undefined)throw new Error('Missing pickup');
  const steps=parent.disposeSteps();steps.next();finish(pickupFiles.get(first.file)??new Uint8Array());
  await expect(pending).rejects.toThrow('owner retired');expect(read).toHaveBeenCalledTimes(1);
  for(const _step of steps){ /* finish the original owner retirement */ }
});

it('legacy inline pickup rows retain the original decoder and fresh native geometry',()=>{
  const inline={...data,geometries:data.geometries.map(({file,...row})=>({ ...row,data:Buffer.from(zlibSync(pickupFiles.get(file)??new Uint8Array())).toString('base64') }))};
  try{
    installPickupCatalogue(inline);
    const recipe=authoredPickups.find(row=>row.id==='coin')?.parts[0];if(recipe===undefined)throw new Error('Missing coin');
    const a=coinModel(0xc01),b=recipe.geometry(0xc01);sameGeometry(a,b);a.dispose();b.dispose();
  }finally{installPickupCatalogue(data,pickupFiles);}
});
