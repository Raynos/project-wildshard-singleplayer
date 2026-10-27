import {nativeBakeFloats,originalNativeGround} from './fixtures/native-bake-inline';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { createNativeBakeReader, nativeBakeGround, installNativeCollision } from '../src/game/population/nativeBake';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
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
const reader = () => createNativeBakeReader(source, { label: 'Driftwood', resolution: 256, size: 500, parked: false, rig: 'axis', shapes: [1, 2, 9], provenance: 'tagged' },
  { file: floorFile, bytes: ground }, [{ file: hullFile, bytes: hulls }]);

// Pins captured before converting the original base64 rows; all non-buffer fields remain part of the comparison.
function metadata(input: unknown): string {
  const row = v.parse(v.record(v.string(), v.unknown()), structuredClone(input));
  const floor = v.parse(v.record(v.string(), v.unknown()), row['ground']);
  Reflect.deleteProperty(floor, 'heights'); row['ground'] = floor;
  row['solids'] = v.parse(v.array(v.record(v.string(), v.unknown())), row['solids']).map(solid => {
    Reflect.deleteProperty(solid, 'vertices'); Reflect.deleteProperty(solid, 'indices'); return solid;
  });
  return hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(row)));
}

test('Driftwood retains every ordered hull, floor byte and non-buffer authoring field', () => {
  const intake = reader(), solids = admitted.solids.map(row => intake.solid(row)), joined = new Uint8Array(138228); let at = 0, count = 0;
  for (const solid of solids) for (const array of [solid.points, solid.indices]) {
    if (array === undefined) continue;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    joined.set(bytes, at); at += bytes.length; count++;
  }
  expect([solids.length, at, count]).toEqual([2067, 138228, 95]);
  expect(hashImmutableBytes(joined)).toBe('13fd9051d5d358bf8618f6c2ceda612e49387c540e8b51c04c2c2d0a2ebde396');
  expect(hashImmutableBytes(ground)).toBe('a859cfc1c1ae5a599f70c0160d34f771ff5d8bc500b2581db2d40880dc31ad94');
  const authored: unknown = JSON.parse(new TextDecoder().decode(fixtureBytes(new URL('../src/shards/driftwood-isle/data/physicsRows.json', import.meta.url))));
  expect(metadata(authored)).toBe('7a4fc27a4800f61bb29376d7cbd5c3937d30fb16f358e0e3ceeba21f4ec7f670');
  expect(metadata(source)).toBe('88962d0811b5da68ccef5e4c395680ffd14d0a05fa919cd4fb587d547b3dc77a');
});

test('modern authoring refuses complete and malformed inline floors before decoding', () => {
  const complete = btoa(Array.from(ground, byte => String.fromCodePoint(byte)).join(''));
  expect(atob(complete).length).toBe(262144);
  for (const heights of [complete, 'not-base64!', ''])
    expect(() => driftwoodNativeRows({ ...source, ground: { ...admitted.ground, heights } })).toThrow('Driftwood native authoring requires a named floor file');
  expect(driftwoodNativeRows(source).physics.ground.heights).toEqual({ file: floorFile });
});

test('one pure producer emits the original native floor and standard named binary declarations', async () => {
  const floor = driftwoodPhysicsFloor(), metadataBytes = new TextEncoder().encode(`${JSON.stringify(driftwoodPhysics())}\n`);
  expect(floor.bytes).toEqual(ground);
  expect([floor.file.name, floor.file.decoded]).toEqual([floorFile, 262144]);
  expect(metadataBytes.byteLength).toBe(676075);
  expect(hashImmutableBytes(metadataBytes)).toBe('cf3bd8df1a8294501131cc9509acad3b5aa26e7e2ed5ef45717085a3b16a5717');
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
