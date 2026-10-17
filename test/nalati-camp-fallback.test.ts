import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyRig } from '../src/engine/world/skyRig';
import { withPortableMath } from '../src/commons/bake/portableMath';
import { buildCampPeople, personFigure, type PersonId } from '../src/shards/nalati-grasslands/campPeople';
import { buildPeopleFallback } from '../src/shards/nalati-grasslands/generators/places';
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };

function isGeometry(value: unknown): value is THREE.BufferGeometry { return value instanceof THREE.BufferGeometry; }

function geometryOf(object: THREE.Object3D): THREE.BufferGeometry {
  if (!(object instanceof THREE.Mesh)) throw new Error('Missing fallback mesh');
  const geometry: unknown = object.geometry;
  if (!isGeometry(geometry)) throw new Error('Missing fallback geometry');
  return geometry;
}

function testSky(): SkyRig {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  return sky;
}
afterEach(() => { vi.restoreAllMocks(); });

for (const id of Object.keys(frames) as PersonId[]) it(`${id} keeps every fallback attribute and its pivot after the bake`, () => {
  const original = withPortableMath(() => buildPeopleFallback(id)), baked = personFigure(testSky(), id);
  const originals = [original.body, original.head, original.arm];
  expect(baked.group.children).toHaveLength(3);
  for (const [index, object] of baked.group.children.entries()) {
    const before = originals[index];
    if (!(object instanceof THREE.Mesh) || before === undefined) throw new Error('Missing fallback part');
    const after = geometryOf(object);
    expect(Object.keys(after.attributes)).toEqual(Object.keys(before.attributes));
    for (const name of Object.keys(before.attributes)) expect(Array.from(after.getAttribute(name).array)).toEqual(Array.from(before.getAttribute(name).array));
    expect(after.index).toBeNull();
    before.dispose(); after.dispose();
  }
  expect(baked.group.children[1]?.position.toArray()).toEqual(frames[id].neck);
  expect(baked.group.children[2]?.position.toArray()).toEqual(frames[id].shoulder);
});

it('keeps visible, moving and talking camp figures after a rig download fails', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const camp = buildCampPeople(testSky(), () => 12, null, undefined, () => Promise.reject(new Error('download unavailable')));
  await camp.ready;
  expect(warning).toHaveBeenCalledOnce();
  const batch = camp.group.children.find(object => object instanceof THREE.BatchedMesh);
  if (!(batch instanceof THREE.BatchedMesh)) throw new Error('Missing fallback batch');
  expect(batch.visible).toBe(true);
  expect(batch.instanceCount).toBe(15);
  for (const person of Object.values(camp.fig)) expect(person.feet.y).toBe(12);
  const before = new THREE.Matrix4(); batch.getMatrixAt(0, before);
  camp.fig.elder.talking = true;
  camp.update(0.25, 3, camp.fig.elder.feet.clone().add(new THREE.Vector3(2, 0, 1)));
  const after = new THREE.Matrix4(); batch.getMatrixAt(0, after);
  expect(after.equals(before)).toBe(false);
  expect(camp.fig.elder.headWorld.y).toBeGreaterThan(13);
  const childBefore = camp.fig.child.feet.clone();
  camp.update(0.25, 3.25, new THREE.Vector3(content.people.elder.x, 12, content.people.elder.z));
  expect(camp.fig.child.feet.equals(childBefore)).toBe(false);
  expect(batch.visible).toBe(true);
  batch.dispose();
});
