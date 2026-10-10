// SF67: Nalati's camp, dressing props and camp clutter built a part a task draw exactly what the one-task builds drew
// (same rng streams, same order). At landing all three fingerprints matched the pre-slicing builds of bfdd53040.
// oxlint-disable-next-line import/no-nodejs-modules -- Fingerprint the built geometry bytes.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { terrainHeight } from '../../../src/engine/world/terrainHeight';
import { Flutter } from '../../../src/shards/nalati-grasslands/world/Flutter';
import { Smoke } from '../../../src/shards/nalati-grasslands/world/Smoke';
import { buildNomadCamp, nomadCampSteps } from '../../../src/shards/nalati-grasslands/world/NomadCamp';
import { buildSummerCamp, summerCampSteps } from '../../../src/shards/nalati-grasslands/world/SummerCamp';
import { buildKurganField, kurganFieldSteps } from '../../../src/shards/nalati-grasslands/world/KurganField';
import { planDressing } from '../../../src/shards/nalati-grasslands/world/dressing/place';
import { buildCampClutter, buildCampClutterSliced, buildStatics, buildStaticsSliced } from '../../../src/shards/nalati-grasslands/world/dressing/statics';

const lights: THREE.DirectionalLight[] = [];
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lights, lightDirection: new THREE.Vector3(0, -1, 0) }, sunDir: new THREE.Vector3(0, 1, 0) } as Sky;
const ground = (x: number, z: number): number => terrainHeight(x, z);

function fingerprint(objects: readonly THREE.Object3D[], extra: unknown): string {
  const hash = createHash('sha256');
  for (const object of objects) object.traverse((child) => {
    const geometry: unknown = child instanceof THREE.Mesh ? child.geometry : null;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    hash.update(child.name);
    for (const name of ['position', 'normal', 'color', 'uv']) {
      const attribute: unknown = geometry.getAttribute(name);
      if (attribute instanceof THREE.BufferAttribute) hash.update(new Uint8Array(new Float32Array(Array.from(attribute.array, Number)).buffer));
    }
  });
  hash.update(JSON.stringify(extra));
  return hash.digest('hex');
}
const sliceEvery = (n: number) => { let calls = 0; return { due: (): Promise<void> | null => (++calls % n === 0 ? Promise.resolve() : null), calls: () => calls }; };

it('builds the camp a part a task with the one-task camp', () => {
  const eager = buildNomadCamp({ sky, ground, flutter: new Flutter(), smoke: new Smoke() });
  const steps = nomadCampSteps({ sky, ground, flutter: new Flutter(), smoke: new Smoke() });
  let parts = 0, step = steps.next();
  while (step.done !== true) { parts++; step = steps.next(); }
  expect(parts).toBe(4); // the places bake: a baked mesh a task (the yard, the felt, the painted mesh, the timber)
  const camp = step.value;
  expect(fingerprint([camp.object], [camp.colliders, camp.tris])).toBe(fingerprint([eager.object], [eager.colliders, eager.tris]));
});

it('builds the summer camp and the kurgan field a part a task with their one-task builds', () => {
  const ctx = () => ({ sky, ground, flutter: new Flutter(), smoke: new Smoke() });
  const drain = <T>(steps: Generator<void, T>): [T, number] => { let parts = 0; for (;;) { const step = steps.next(); if (step.done === true) return [step.value, parts]; parts++; } };
  const summer = buildSummerCamp(ctx()), [summerSliced, summerParts] = drain(summerCampSteps(ctx()));
  expect(summerParts).toBe(4); // a baked mesh a task
  expect(fingerprint([summerSliced.object], [summerSliced.colliders, summerSliced.tris])).toBe(fingerprint([summer.object], [summer.colliders, summer.tris]));
  const field = buildKurganField(ctx()), [fieldSliced, fieldParts] = drain(kurganFieldSteps(ctx()));
  expect(fieldParts).toBeGreaterThan(4);
  expect(fingerprint([fieldSliced.piece.object], [fieldSliced.piece.colliders, fieldSliced.entrance, fieldSliced.balbalSpots])).toBe(fingerprint([field.piece.object], [field.piece.colliders, field.entrance, field.balbalSpots]));
});

it('builds the dressing props and the camp clutter in slices with the one-task builds', async () => {
  const plan = await planDressing(null);
  const eager = buildStatics(sky, plan, new Flutter());
  const slice = sliceEvery(3);
  const sliced = await buildStaticsSliced(sky, plan, new Flutter(), slice.due);
  expect(slice.calls()).toBeGreaterThan(10);
  const print = (s: typeof eager): string => fingerprint(s.meshes, [s.colliders, s.descs, s.tris]);
  expect(print(sliced)).toBe(print(eager));
  const avoid = [...eager.colliders];
  const clutter = buildCampClutter(sky, avoid), clutterSliced = await buildCampClutterSliced(sky, avoid, sliceEvery(2).due);
  const printClutter = (c: typeof clutter): string => fingerprint(c.mesh === null ? [] : [c.mesh], [c.colliders, c.tris, c.spots]);
  expect(printClutter(clutterSliced)).toBe(printClutter(clutter));
}, 60_000); // two dressing builds: ~17 s alone at load, past the 20 s default beside the other Nalati builders
