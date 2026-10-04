import { afterEach, expect, it } from 'vitest';
import { Scene, Vector3, Object3D, Quaternion } from 'three';
import { app } from '#engine';
import { WorldRegistry } from '#engine-internal/world/registry';
import { boxInFrame } from '#engine-internal/physics/box';
import { Interactables } from '#engine-internal/world/interact/Interactables';
import { Flags } from '#engine-internal/world/interact/flags';
import type { Sky } from '#engine-internal/world/Sky';

function fake<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get: (target, key) => {
    if (!(key in target)) throw new Error(`Unimplemented fixture field ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}
afterEach(() => { app.registryValue = null; });
it('registers a following fallback barrel, a static lever and a door that releases collision while open', () => {
  const registry = new WorldRegistry(); app.registryValue = registry; app.bodies = null;
  const flags = new Flags('f11-test');
  const kit = new Interactables({ scene: new Scene(), sky: fake<Sky>({ setupMaterial: () => undefined }),
    player: { position: new Vector3(100, 0, 100), velocity: new Vector3() }, flags,
    place: (p) => ({ x: p.x, y: 2, z: p.z, yaw: 0.7 }), floorAt: () => 2, prompts: [] }).build({ external: [], rows: [
      { id: 'barrel', kind: 'barrel', at: { poi: 'world', x: 8, z: 4 }, leash: 10 },
      { id: 'lever', kind: 'lever', at: { poi: 'world', x: 4, z: 4 } },
      { id: 'door', kind: 'door', at: { poi: 'world', x: 0, z: 4 }, w: 2, h: 3, look: 'plank' },
    ] });
  const barrel = registry.get('interact-barrel'), lever = registry.get('interact-lever'), door = registry.get('interact-door');
  expect(barrel?.follows).toBe(kit.live('barrel')?.object); expect(lever?.follows).toBeUndefined();
  const box = barrel?.colliders?.[0];
  if (box?.kind !== 'box') throw new Error('Expected barrel box');
  expect(box.x).toBeCloseTo(0); expect(box.z).toBeCloseTo(0); expect(box).toMatchObject({ y: 0.25, hy: 0.75 });
  // The legacy refresh changes the lever from its authored 0.4 m to a 1.2 m state box.
  expect(lever?.colliders?.[0]).toMatchObject({ x: 4, z: 4, y: 2.35 });
  const leverBox = lever?.colliders?.[0];
  if (leverBox?.kind !== 'box') throw new Error('Expected lever box');
  expect(leverBox.hy).toBeCloseTo(0.85);
  expect(door?.active?.()).toBe(true); flags.set('open:door'); kit.update(0.1, 0.1);
  expect(door?.active?.()).toBe(false); kit.dispose(); expect(lever?.active?.()).toBe(false);
});
it('keeps NPC world boxes aligned at registration and when their figure moves', () => {
  const object = new Object3D(); object.position.set(12, 4, -9); object.rotation.y = 1.2;
  const desc = boxInFrame({ x: 12, z: -9, hw: 0.28, hd: 0.28, rot: 0, yBottom: 3.7, yTop: 5.8 }, object);
  if (!desc.rot) throw new Error('Expected oriented box');
  expect(object.localToWorld(new Vector3(desc.x, desc.y, desc.z)).toArray()).toEqual([12, 4.75, -9]);
  const worldRotation = object.getWorldQuaternion(new Quaternion()).multiply(new Quaternion(desc.rot.x, desc.rot.y, desc.rot.z, desc.rot.w));
  expect(worldRotation.angleTo(new Quaternion())).toBeCloseTo(0);
  object.position.x += 5;
  expect(object.localToWorld(new Vector3(desc.x, desc.y, desc.z)).x).toBe(17);
});
