import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the native loader on the shipped rig bytes.
import { readFileSync } from 'node:fs';
import { readSourceModel } from '../src/sdk/bake/skinned';
import * as rigLoader from '../src/engine/anim/rig';
import * as lookCompiler from '../src/game/shardfile/runtimeProduct';
import { ToonLook } from '../src/engine/render/families/toon';
import { BufferGeometry, InterleavedBufferAttribute, Color, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector2, Vector3, Vector4 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { SkyRig } from '../src/engine/world/skyRig';
import { parseToonArmsLook } from '../src/format/heldArms';
import { ToonArms } from '../src/game/systems/viewmodel/toonArms';

// A fictional harbour look uses the native rig loader and resolver. Spies observe the file/compiler
// seams; neither seam is a parameter of the held host's public API.
type Looks = Awaited<ReturnType<typeof lookCompiler.runtimeLookMaterials>>;
function context(): ShardContext { return { scope: new Scope('held-fixture'), product: { shardfile: {} } } as ShardContext; }


const row = {
  lighting: { id: 'fixture-harbour.day', initial: { uToonLift: [.1, .2, .3], uToonRim: [.3, .2, .1], uCloudShadow: .6, uToonNight: 0, uSeaLevel: 2, uCloudTime: 3 } },
  url: '/assets/fixture-harbour/arms.glb', skeleton: 'harbour-rig', sockets: ['R_weapon', 'L_hand'],
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'], fingers: ['thumb', 'index', 'middle', 'ring', 'pinky'], phalanges: 3 },
  offset: [.1, -.02, 0], frame: { size: .7, pitch: -.1, yaw: .02, roll: 0 }, sunward: 2, bladeBase: .01,
  swim: { tilt: .8, handsZ: -.4, waterY: -.2, startD: -.3 },
  materials: { arms: 'harbour-linen', wood: 'harbour-oak', iron: 'harbour-steel', swim: 'harbour-wet' },
};
function lighting() {
  return { source: ToonArms.lighting(row),
    target: { famToonLift: { value: new Color() }, famToonRim: { value: new Color() },
      famToonCloud: { value: new Vector4() }, famToonWater: { value: new Vector2() }, famToonTime: { value: 0 } } };
}

const sky = { csm: { lightDirection: new Vector3(1, -2, 3) } } as SkyRig;
const catalogue = (): Looks => ({ toon: new ToonLook(), materials: new Map(Object.values(row.materials).map(id => [id, new MeshBasicMaterial()])),
  setParam: vi.fn<Looks['setParam']>(), setTexture: vi.fn<Looks['setTexture']>(), textures: new Map(), compile: () => new MeshBasicMaterial(),
  bindMeshMap: () => new MeshBasicMaterial(), tick: () => undefined, outline: () => [],
  graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } }, surfaces: null });
let queuedLooks: Looks[] = [];

beforeEach(() => {
  vi.spyOn(rigLoader, 'loadRigFile').mockImplementation(async () => {
    const source = await readSourceModel(readFileSync('public/assets/models/driftwood-fp/fp-arms.glb'));
    const root = source.gltf.scene.getObjectByName('vm_root');
    if (root === undefined) throw new Error('Missing fixture rig root');
    root.userData['rig'] = row.skeleton;
    root.userData['swords'] = { wood: { bladeBase: .012, bladeTip: .532 }, iron: { bladeBase: .025, bladeTip: .572 } };
    return source.gltf;
  });
  vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockImplementation(() => {
    const next = queuedLooks.shift(); if (next === undefined) throw new Error('Missing compiled fixture catalogue');
    return Promise.resolve(next);
  });
});
afterEach(() => { vi.restoreAllMocks(); });

test('second-shard rows drive held materials, sword glow, sockets and independent loans', async () => {
  const host = new ToonArms(row), first = catalogue(), latest = catalogue(), light = lighting();
  expect(host.contract).toMatchObject({ skeleton: row.skeleton, sockets: row.sockets });
  expect(host.bake.joints?.[0]).toHaveLength(44);
  expect(host.bake.joints?.[0]?.slice(0, 3)).toEqual(['R_shoulder', 'R_upperarm', 'R_forearm']);
  const firstScope = context(), latestScope = context();
  queuedLooks = [first, latest];
  await host.prepare(firstScope); await host.prepare(latestScope);
  light.target = latest.toon.uniforms;
  const held = await host.load();
  const wood = held.arms;
  if (wood === undefined) throw new Error('Missing fixture sword arms');
  wood.setup?.(sky); held.ironArms?.setup?.(sky);
  expect(latest.setParam).toHaveBeenCalledWith(row.materials.iron, 'bladeBase', .025);
  held.ironArms?.glow?.(.7);
  expect(latest.setParam).toHaveBeenCalledWith(row.materials.iron, 'rim', .7);
  const root = await host.specimen(sky, 'iron');
  const mesh = root.children.find((part): part is Mesh<BufferGeometry, MeshBasicMaterial> => part instanceof Mesh && part.name === 'arms');
  expect(mesh).toBeInstanceOf(Mesh);
  if (mesh === undefined) throw new Error('Missing fixture arms');
  expect(mesh.material).toBe(latest.materials.get(row.materials.arms));
  const ironMesh = root.getObjectByName('sword_iron');
  if (!(ironMesh instanceof Mesh)) throw new Error('Missing fixture iron mesh');
  const ironGeometry: unknown = ironMesh.geometry;
  if (!(ironGeometry instanceof BufferGeometry)) throw new Error('Missing fixture iron geometry');
  expect(ironGeometry.getAttribute('aMetal')).toBeInstanceOf(InterleavedBufferAttribute);
  expect(ironGeometry.hasAttribute('_metal')).toBe(false);
  // The host follows the original light only at draw time, with borrowed graph parameters.
  const draw = mesh.onBeforeRender.bind(mesh);
  Reflect.apply(draw, mesh, []);
  expect(light.target.famToonLift.value).toEqual(light.source.uToonLift.value);
  expect(light.target.famToonRim.value).toEqual(light.source.uToonRim.value);
  expect(light.target.famToonCloud.value.x).toBe(.6);
  expect(light.target.famToonWater.value.x).toBe(2);
  expect(light.target.famToonTime.value).toBe(3);
  expect(latest.setParam).toHaveBeenCalledWith(row.materials.wood, 'sunward', [-2, 4, -6]);
  expect(first.setParam).not.toHaveBeenCalled();
  firstScope.scope.dispose();
  expect(() => wood.glow?.(.2)).not.toThrow();
  latestScope.scope.dispose();
  expect(() => wood.glow?.(.2)).toThrow('no graph materials prepared');
  const geometry: BufferGeometry = mesh.geometry; geometry.dispose();
});

test('second-shard swimming uses its material and plane; submerged hands clip below water', async () => {
  const host = new ToonArms(row), looks = catalogue(); queuedLooks = [looks]; await host.prepare(context());
  const { swim } = await host.load();
  if (swim === undefined) throw new Error('Missing fixture swim arms');
  swim.setup(sky);
  expect(looks.setParam).toHaveBeenCalledWith(row.materials.swim, 'waterD', -.3);
  const camera = new PerspectiveCamera(70, .5, .1, 100);
  swim.update(.016, { stroke: 1, phase: .4, camera, eyeAbove: 1 });
  expect(looks.setParam).toHaveBeenCalledWith(row.materials.swim, 'waterN', expect.any(Array));
  swim.update(.016, { stroke: 1, phase: .4, camera, eyeAbove: 0 });
  expect(looks.setParam).toHaveBeenLastCalledWith(row.materials.swim, 'waterD', 50);
  expect(swim.root.scale.toArray()).toEqual([1, 1, 1]);
});

test('held arms refuse malformed rows and missing catalogue bindings before dressing', async () => {
  expect(parseToonArmsLook(row)).toEqual(row);
  for (const bad of [{ ...row, offset: [0, 0] }, { ...row, sunward: Infinity },
    { ...row, joints: { ...row.joints, phalanges: 0 } }, { ...row, sockets: ['R_weapon', 'R_weapon'] },
    { ...row, frame: { ...row.frame, surprise: 1 } }]) expect(() => new ToonArms(bad)).toThrow();
  queuedLooks = [{ ...catalogue(), materials: new Map() }];
  await expect(new ToonArms(row).prepare(context())).rejects.toThrow('look.materials lacks');
});
