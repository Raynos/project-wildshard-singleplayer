import { beforeAll, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { encodeMeshCollision } from '../src/engine/core/meshCollision';
import { installBakedMeshColliders } from '../src/engine/physics/meshCollision';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { castRay, floorBelow } from '../src/engine/physics/query';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
const floor = (y: number) => encodeMeshCollision({ vertices: Float32Array.of(-5, y, -5, 5, y, -5, -5, y, 5, 5, y, 5), indices: Uint32Array.of(0, 2, 1, 1, 2, 3) });
const rows = () => [{ id: 'ground', bytes: floor(0), initialActive: true }, { id: 'door', bytes: floor(4), initialActive: false }];

it('uses target activation ports and reconnects exact native handles without allocating or resetting saved activation', () => {
  const scope = new Scope('initial-mesh'), freshScope = new Scope('restored-mesh'), physics = new Physics(rapier);
  let restored: Physics | undefined;
  try {
    const ports = installBakedMeshColliders(rows(), physics, scope), door = ports.get('door');
    if (door === undefined) throw new Error('Door fixture');
    physics.step(); expect(floorBelow(physics, 0, 0, 8, 10)).toBeCloseTo(0);
    expect(scope.census.colliders).toBe(2); door.setActive(true); physics.step();
    expect(floorBelow(physics, 0, 0, 8, 10)).toBeCloseTo(4);
    expect(castRay(physics, { x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 }, 10)?.owner).toBe('door');
    const saved = new Map([...ports].map(([id, port]) => [id, port.snapshot()])), bytes = physics.snapshot();
    restored = new Physics(rapier, bytes);
    const count = restored.world.colliders.len();
    const reconnected = installBakedMeshColliders(rows(), restored, freshScope, saved);
    expect(restored.world.colliders.len()).toBe(count); expect(reconnected.get('door')?.active()).toBe(true);
    expect([...reconnected].map(([id, port]) => [id, port.snapshot()])).toEqual([...saved]);
    expect(castRay(restored, { x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 }, 10)?.owner).toBe('door');
    freshScope.dispose(); expect(restored.world.colliders.len()).toBe(0); expect(freshScope.census.colliders).toBe(0);
    expect(physics.world.colliders.len()).toBe(2); scope.dispose(); expect(physics.world.colliders.len()).toBe(0);
  } finally { scope.dispose(); freshScope.dispose(); physics.dispose(); restored?.dispose(); }
});
it('a pending adapter follows world replacement and its cleanup removes only the current restored handles', () => {
  let current = new Physics(rapier);
  const initialScope = new Scope('mesh-native'), scope = new Scope('pending-mesh');
  try {
    const native = installBakedMeshColliders(rows(), current, initialScope), saved = new Map([...native].map(([id, port]) => [id, port.snapshot()]));
    const pending = installBakedMeshColliders(rows(), () => current, scope, new Map(rows().map(row => [row.id, { handles: [] }])));
    expect(current.world.colliders.len()).toBe(2); expect(() => pending.get('door')?.active()).toThrow('Missing mesh');
    const snapshot = current.snapshot(); initialScope.dispose(); current.dispose(); current = new Physics(rapier, snapshot);
    for (const [id, state] of saved) pending.get(id)?.restore(state);
    expect(current.world.colliders.len()).toBe(2); expect(pending.get('door')?.active()).toBe(false);
    pending.get('door')?.setActive(true); current.step(); expect(floorBelow(current, 0, 0, 8, 10)).toBeCloseTo(4);
    scope.dispose(); expect(current.world.colliders.len()).toBe(0);
  } finally { initialScope.dispose(); scope.dispose(); current.dispose(); }
});
it('preflights the last malformed chunk and duplicate identities before allocating any collider', () => {
  const physics = new Physics(rapier), scope = new Scope('bad-mesh-rows');
  try {
    expect(() => installBakedMeshColliders([...rows(), { id: 'late', bytes: new Uint8Array(24), initialActive: true }], physics, scope)).toThrow('Mesh collision');
    expect(() => installBakedMeshColliders([...rows(), ...rows()], physics, scope)).toThrow('identities');
    expect(physics.world.colliders.len()).toBe(0); expect(scope.census.colliders).toBe(0);
  } finally { scope.dispose(); physics.dispose(); }
});
it('refuses missing or wrong-geometry restored handles without allocating or changing valid ports', () => {
  const physics = new Physics(rapier), scope = new Scope('native-mesh'), refused = new Scope('refused-mesh');
  try {
    const ports = installBakedMeshColliders(rows(), physics, scope), door = ports.get('door'), ground = ports.get('ground');
    if (door === undefined || ground === undefined) throw new Error('Missing fixture ports');
    const saved = new Map([...ports].map(([id, port]) => [id, port.snapshot()]));
    expect(() => installBakedMeshColliders(rows(), physics, refused, new Map())).toThrow('restore identities');
    expect(() => installBakedMeshColliders(rows(), physics, refused, new Map([...saved, ['door', ground.snapshot()]]))).toThrow('geometry mismatch');
    expect(() => door.restore({ handles: [Number.MIN_VALUE * 12345] })).toThrow('Missing mesh');
    expect(door.snapshot()).toEqual(saved.get('door')); expect(door.active()).toBe(false);
    expect(physics.world.colliders.len()).toBe(2); expect(refused.census.colliders).toBe(0);
  } finally { refused.dispose(); scope.dispose(); physics.dispose(); }
});
