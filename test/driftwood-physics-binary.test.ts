import {nativeBakeFloats,originalNativeGround} from './fixtures/native-bake-inline';
import { expect, test } from 'vitest';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { createNativeBakeReader, nativeBakeGround, installNativeCollision } from '../src/game/population/nativeBake';
import { readNamedBlob } from '../src/sdk/blobs';
import { driftwoodPhysics, driftwoodPhysicsFloor, driftwoodPhysicsGroundBytes, driftwoodPhysicsSources } from '../src/shards/driftwood-isle/generators/physics';
import { driftwoodNativeRows } from '../src/shards/driftwood-isle/generators/nativeBake';
import { trustedLevel } from '../src/game/plugin/simulation';
import type { HeadlessRuntimePlan } from '../src/sdk/headlessRuntime';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { canonicalSimDigest } from './fake/simState';

const source = driftwoodPhysics(), admitted = driftwoodNativeRows(source).physics;
const floorFile = 'data/physics-ground.generated.bin', hullFile = 'data/physics-colliders.bin';
const ground = driftwoodPhysicsGroundBytes();
const hulls = fixtureBytes(new URL('../src/shards/driftwood-isle/data/physics-colliders.bin', import.meta.url));

test('modern authoring refuses complete and malformed inline floors before decoding', () => {
  const complete = btoa(Array.from(ground, byte => String.fromCodePoint(byte)).join(''));
  expect(atob(complete).length).toBe(262144);
  for (const heights of [complete, 'not-base64!', ''])
    expect(() => driftwoodNativeRows({ ...source, ground: { ...admitted.ground, heights } })).toThrow('Driftwood native authoring requires a named floor file');
  expect(driftwoodNativeRows(source).physics.ground.heights).toEqual({ file: floorFile });
});

test('one pure producer emits the original native floor and standard named binary declarations', async () => {
  const floor = driftwoodPhysicsFloor();
  expect(floor.bytes).toEqual(ground);
  expect([floor.file.name, floor.file.decoded]).toEqual([floorFile, 262144]);
  expect(driftwoodPhysicsSources().map(row => [row.name, row.options.decoded])).toEqual([[hullFile, 138228]]);
  for (const row of driftwoodPhysicsSources()) {
    const blob = await readNamedBlob('src/shards/driftwood-isle', row.name, row.source, row.kind, row.options);
    expect(blob.bytes).toEqual(row.name === floorFile ? ground : hulls);
    expect(blob.file.decoded).toBe(blob.bytes.length);
  }
});

test('the shipped assembly reads the raw files and retains native collision, save and restore order', async () => {
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm', import.meta.url))));
  const declaration = { constants: { physics: source } };
  const shard = emptyShardfile({ slug: 'raw-native', name: 'Raw Native', author: 'Test', revision: 1, seed: 1 });
  const data = new Map([['sim/headless-assembly.json', new TextEncoder().encode(JSON.stringify(declaration))], [floorFile, ground], [hullFile, hulls]]);
  const reads: string[] = [];
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([...data.keys()].map(name => [name, { hash: name, url: name }])), read: name => {
      reads.push(name); const bytes = data.get(name); if (bytes === undefined) throw new Error('Missing native fixture file'); return Promise.resolve(bytes);
    } });
  const {constants}=await product.json<{constants:{physics:typeof admitted}}>('sim/headless-assembly.json');
  const floor=await product.file(floorFile),colliders=await product.file(hullFile);
  const intake=createNativeBakeReader(constants.physics,{label:'Driftwood',resolution:256,size:500,parked:false,rig:'axis',shapes:[1,2,9],provenance:'tagged'},
    {file:floorFile,bytes:floor},[{file:hullFile,bytes:colliders}]);
  const bake={ground:nativeBakeGround(constants.physics.ground,256,500,'Driftwood',{file:floorFile,bytes:floor}),
    solids:constants.physics.solids.map(row=>intake.solid(row))};
  const plan:HeadlessRuntimePlan={level:trustedLevel(shard,{at:{x:shard.spawn.x,y:Math.max(shard.spawn.y,.1),z:shard.spawn.z},yaw:shard.spawn.yaw,speed:5},{size:500,height:0}),
    ports:{ground:false,heightAt:()=>0},install:(host,context)=>{if(!context.restoring)installNativeCollision(host,bake,{resolution:256});}};
  expect(reads).toEqual(['sim/headless-assembly.json', floorFile, hullFile]);
  const original = createSimHost(plan.level, { ...plan.ports, rapier }), candidate = createSimHost(plan.level, { ...plan.ports, rapier });
  const inline = (bytes: Uint8Array): string => { let result = ''; for (const byte of bytes) result += String.fromCodePoint(byte); return btoa(result); };
  // Frozen pre-cut map: merge nativeBakeFloats(vertices) in source order; no generic actor reader replaces DW's pose intake.
  const baseline = { ground: originalNativeGround({ ...admitted.ground, heights: inline(ground) }, 256, 500, 'Driftwood'),
    solids: admitted.solids.map(({ vertices, indices, ...row }) => {
      if (indices !== undefined) throw new Error('Unexpected Driftwood index buffer');
      if (vertices === undefined) return row;
      if (typeof vertices === 'string') throw new Error('Expected converted authored hull');
      return Object.assign(row, { points: nativeBakeFloats(inline(hulls.subarray(vertices.byteOffset, vertices.byteOffset + vertices.byteLength))) });
    }) };
  const context = { restoring: false, commands: () => [], emit: () => undefined };
  try {
    installNativeCollision(original, baseline, { resolution: 256 }); plan.install(candidate, context);
    const command = { moveX: 0, moveZ: -1, yaw: 0 };
    for (let tick = 0; tick < 3; tick++) { original.step(command); candidate.step(command); }
    const saved = snapshotSimHost(candidate);
    expect(serializeSimSnapshot(saved)).toBe(serializeSimSnapshot(snapshotSimHost(original)));
    const restored = restoreSimHost(plan.level, { ...plan.ports, rapier }, saved, host => plan.install(host, { ...context, restoring: true, snapshot: saved }));
    try {
      for (let tick = 0; tick < 3; tick++) { original.step(command); candidate.step(command); restored.step(command); }
      expect(canonicalSimDigest(snapshotSimHost(candidate))).toBe(canonicalSimDigest(snapshotSimHost(original)));
      expect(canonicalSimDigest(snapshotSimHost(restored))).toBe(canonicalSimDigest(snapshotSimHost(original)));
    } finally { restored.dispose(); }
  } finally { candidate.dispose(); original.dispose(); }
});
