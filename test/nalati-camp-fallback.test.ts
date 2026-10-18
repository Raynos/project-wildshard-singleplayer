// oxlint-disable-next-line import/no-nodejs-modules -- Read the shipped prepared skin for a renderer-free pose comparison.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope } from '../src/engine/app/scope';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { FigureSkins } from '../src/game/systems/npc/figureSkins';
import * as rigLoader from '../src/engine/anim/rig';
import type { NpcFigureFrame, NpcFigureRig } from '../src/game/systems/npc/figureRig';
import { buildCampPeople as originalPeople } from '../src/shards/nalati-grasslands-legacy/campPeople';
import { enteredPeople } from '../src/shards/nalati-grasslands/models/people';
import shard from '../src/shards/nalati-grasslands/shard.config';
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };

type PersonId = keyof typeof frames;
function testSky(): SkyRig {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined); return sky;
}
async function prepared<K extends PersonId>(_sky: SkyRig, selected: Record<K, NpcFigureFrame>): Promise<NpcFigureRig<K>> {
  const loaded = await readSourceModel(readFileSync('public/assets/nalati/baked/people/camp.glb'));
  const candidate = loaded.gltf.scene.getObjectByProperty('isSkinnedMesh', true);
  if (!(candidate instanceof THREE.SkinnedMesh)) throw new Error('Missing prepared skin');
  const mesh = candidate as THREE.SkinnedMesh;
  const bones = {} as NpcFigureRig<K>['bones'];
  for (const id of Object.keys(selected) as K[]) {
    const joint = (part: string): THREE.Bone => {
      const bone = mesh.skeleton.bones.find(b => b.name === `${id}-${part}`);
      if (bone === undefined) throw new Error('Missing joint');
      bone.removeFromParent(); bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false; return bone;
    };
    const root = joint('root'), head = joint('head'), arm = joint('arm');
    bones[id] = { root, head, arm, neck: head.position.clone(), shoulder: arm.position.clone() };
  }
  return { mesh, bones };
}
const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (documentBefore === undefined) Reflect.deleteProperty(globalThis, 'document');
  else Object.defineProperty(globalThis, 'document', documentBefore);
  vi.restoreAllMocks();
});

it('keeps all camp root/head/arm matrices, prompts and child motion exact', async () => {
  const selected = Object.fromEntries(Object.entries(frames).map(([id, row]) => [id, {
    height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder),
  }])) as Record<PersonId, NpcFigureFrame>;
  const sky = testSky(), scope = new Scope('camp-pose-test');
  const beforeRig = await prepared(sky, selected), afterRig = await prepared(sky, selected);
  vi.spyOn(FigureSkins, 'prepared').mockResolvedValue(afterRig.mesh);
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }) }) });
  vi.spyOn(rigLoader, 'loadRigFile').mockImplementation(async url => {
    const source = await readSourceModel(readFileSync(`public${url}`));
    source.gltf.scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    });
    return source.gltf;
  });
  const floor = (x: number, z: number): number => 12 + Math.sin(x * 0.01) * Math.cos(z * 0.02);
  const oldRegistry = new WorldRegistry(), newRegistry = new WorldRegistry(); oldRegistry.scope = newRegistry.scope = scope;
  const before = originalPeople(sky, floor, oldRegistry, scope, () => Promise.resolve(beforeRig));
  const after = enteredPeople({ ctx: { scope, product: { shardfile: shard } }, sky, registry: newRegistry }, floor);
  for (const id of Object.keys(frames) as PersonId[]) expect(after.fig[id].headWorld.toArray()).toEqual(before.fig[id].headWorld.toArray());
  await Promise.all([before.ready, after.ready]);
  const colliders = (registry: WorldRegistry) => registry.pieces.map(piece => ({ id: piece.id, name: piece.name, category: piece.category, surface: piece.surface, colliders: piece.colliders }));
  expect(colliders(newRegistry)).toEqual(colliders(oldRegistry));
  expect(newRegistry.pieces.map(piece => piece.file)).toEqual(Array.from({ length: 2 }, () => 'src/shards/nalati-grasslands/models/people.ts'));
  const anchor = (registry: WorldRegistry) => registry.pieces.find(piece => piece.id === 'nalati-camp-child')?.follows?.position.toArray();
  expect(Object.keys(after.fig)).toEqual(Object.keys(before.fig));
  for (let frame = 0; frame < 900; frame++) {
    const dt = frame % 2 === 0 ? 1 / 30 : 1 / 60, time = frame / 30;
    const ids = Object.keys(frames) as PersonId[], nearId = ids[Math.floor(frame / 90) % ids.length];
    if (nearId === undefined) throw new Error('Missing camp figure');
    const at = before.fig[nearId].feet, far = frame > 650 && frame < 700;
    const player = new THREE.Vector3(far ? 200 : at.x + Math.sin(time) * 8, 13, far ? 200 : at.z + Math.cos(time) * 8);
    for (const id of Object.keys(frames) as PersonId[]) before.fig[id].talking = after.fig[id].talking = frame > 90 && frame < 250;
    before.update(dt, time, player); after.update(dt, time, player);
    expect(anchor(newRegistry)).toEqual(anchor(oldRegistry));
    for (const id of Object.keys(frames) as PersonId[]) {
      expect(after.fig[id].feet.toArray()).toEqual(before.fig[id].feet.toArray());
      expect(after.fig[id].headWorld.toArray()).toEqual(before.fig[id].headWorld.toArray());
      expect(after.fig[id].yaw).toBe(before.fig[id].yaw);
      expect(after.group.children.find(child => child instanceof THREE.SkinnedMesh)).toBe(afterRig.mesh);
      for (const part of ['root', 'head', 'arm'] as const) {
        const bone = afterRig.mesh.skeleton.bones.find(candidate => candidate.name === `${id}-${part}`);
        expect(bone?.matrixWorld.toArray()).toEqual(beforeRig.bones[id][part].matrixWorld.toArray());
      }
    }
  }
  scope.dispose();
});

it('refuses a missing prepared skin instead of publishing a substitute camp', async () => {
  const scope = new Scope('camp-failure-test'), failure = new Error('missing skin');
  vi.spyOn(FigureSkins, 'prepared').mockRejectedValue(failure);
  vi.spyOn(rigLoader, 'loadRigFile').mockRejectedValue(failure);
  const camp = enteredPeople({ ctx: { scope, product: { shardfile: shard } }, sky: testSky() }, () => 12);
  await expect(camp.ready).rejects.toBe(failure);
  expect(camp.group.children.every(child => !(child instanceof THREE.Mesh))).toBe(true);
  scope.dispose();
});
