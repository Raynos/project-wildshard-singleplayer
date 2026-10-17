import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector2, Vector3, Vector4 } from 'three';
import type { SkyRig } from '../src/engine/world/skyRig';
import { parseToonArmsLook } from '../src/format/heldArms';
import { ToonArms, type ToonArmsRig, type ToonArmsRigs, type ToonArmsLight } from '../src/game/systems/viewmodel/toonArms';

// An invented second shard supplies its own rig, joints, framing and material identities.
// The fixture implements the rig port; it does not replace any imported module.
function fixtureRigs(): { load: ToonArmsRigs['load'] } {
  return { load: () => {
    const root = new Group();
    const meshes = ['arms', 'sword_wood', 'sword_iron'].map(name => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('_metal', new BufferAttribute(new Float32Array([0, 1, 0]), 1));
      const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.name = name; root.add(mesh); return mesh;
    });
    const rig: ToonArmsRig = { root, nodes: new Map(root.children.map(node => [node.name, node])),
      meta: { clips: {}, swords: { iron: { bladeBase: .025, bladeTip: .6 } }, water: { y: -.22 } },
      meshes: () => meshes, weapon: vi.fn<() => void>(), update: vi.fn<() => void>(), swim: vi.fn<() => void>(),
      play: vi.fn<() => void>(), blade: vi.fn<() => void>() };
    return Promise.resolve(rig);
  } };
}
function lighting(): ToonArmsLight {
  return { source: { uToonLift: { value: new Color(.1, .2, .3) }, uToonRim: { value: new Color(.3, .2, .1) },
    uCloudShadow: { value: .6 }, uSeaLevel: { value: 2 }, uCloudTime: { value: 3 } },
    target: { famToonLift: { value: new Color() }, famToonRim: { value: new Color() },
      famToonCloud: { value: new Vector4() }, famToonWater: { value: new Vector2() }, famToonTime: { value: 0 } } };
}

const row = {
  url: '/assets/fixture-harbour/arms.glb', skeleton: 'harbour-rig', sockets: ['R_weapon', 'L_hand'],
  joints: { sides: ['R', 'L'], arm: ['shoulder', 'hand'], fingers: ['thumb', 'index'], phalanges: 2 },
  offset: [.1, -.02, 0], frame: { size: .7, pitch: -.1, yaw: .02, roll: 0 }, sunward: 2, bladeBase: .01,
  swim: { tilt: .8, handsZ: -.4, waterY: -.2, startD: -.3 },
  materials: { arms: 'harbour-linen', wood: 'harbour-oak', iron: 'harbour-steel', swim: 'harbour-wet' },
};
const sky = { csm: { lightDirection: new Vector3(1, -2, 3) } } as SkyRig;
const catalogue = () => ({ materials: new Map(Object.values(row.materials).map(id => [id, new MeshBasicMaterial()])), setParam: vi.fn<() => void>() });

test('second-shard rows drive held materials, sword glow, sockets and independent loans', async () => {
  const host = new ToonArms(row, fixtureRigs()), first = catalogue(), latest = catalogue(), light = lighting();
  expect(host.contract).toMatchObject({ skeleton: row.skeleton, sockets: row.sockets });
  expect(host.bake.joints).toEqual([['R_shoulder', 'R_hand', 'R_thumb1', 'R_thumb2', 'R_index1', 'R_index2',
    'L_shoulder', 'L_hand', 'L_thumb1', 'L_thumb2', 'L_index1', 'L_index2']]);
  const releaseFirst = host.lend(first, lighting()), releaseLatest = host.lend(latest, light);
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
  expect(mesh.geometry.getAttribute('aMetal')).toBeInstanceOf(BufferAttribute);
  expect(mesh.geometry.hasAttribute('_metal')).toBe(false);
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
  releaseFirst();
  expect(() => wood.glow?.(.2)).not.toThrow();
  releaseLatest();
  expect(() => wood.glow?.(.2)).toThrow('no graph materials lent');
  const geometry: BufferGeometry = mesh.geometry; geometry.dispose();
});

test('second-shard swimming uses its material and plane; submerged hands clip below water', async () => {
  const host = new ToonArms(row, fixtureRigs()), looks = catalogue(); host.lend(looks, lighting());
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

test('held arms refuse malformed rows and missing catalogue bindings before dressing', () => {
  expect(parseToonArmsLook(row)).toEqual(row);
  for (const bad of [{ ...row, offset: [0, 0] }, { ...row, sunward: Infinity },
    { ...row, joints: { ...row.joints, phalanges: 0 } }, { ...row, sockets: ['R_weapon', 'R_weapon'] },
    { ...row, frame: { ...row.frame, surprise: 1 } }]) expect(() => new ToonArms(bad)).toThrow();
  expect(() => new ToonArms(row, fixtureRigs()).lend({ materials: new Map(), setParam: vi.fn<() => void>() }, lighting())).toThrow('look.materials lacks');
});
