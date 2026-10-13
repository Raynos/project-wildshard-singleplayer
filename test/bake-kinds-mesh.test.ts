import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Scene, Texture, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { bakeKinds } from '../src/sdk/bake/kinds';
import { bake, BakedPiece } from '../src/sdk/bake';
import { readScene } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { bakedMeshKindsGroup } from '../src/game/shardfile/bakedKinds';

const isMesh = (node: Object3D | undefined): node is Mesh => node instanceof Mesh;
const isInstanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

it('keeps ordinary standard/unlit meshes, HDR channels and double transforms beside original instances', async () => {
  const standard = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });
  standard.color.setRGB(4.2, 3.7, 3.2); standard.emissive.setRGB(0.07, 0.045, 0.03);
  const basic = new MeshBasicMaterial({ color: 0xffb24a }); basic.color.multiplyScalar(3.2);
  const shell = new Mesh(new BoxGeometry().toNonIndexed(), standard), glass = new Mesh(new BoxGeometry(0.13, 0.28, 0.13), basic);
  shell.position.set(-127.43123456789, 2.739245212345, 96.03); shell.rotation.set(0.03, 0.27, -0.04);
  glass.position.set(-0.22, 0.01, 0);
  const instances = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial({ color: 0x886633 }), 2);
  instances.setMatrixAt(1, new Matrix4().makeTranslation(4, 2, 1));
  const source = [['shell', shell], ['glass', glass], ['posts', instances]] as const;
  const result = bakeKinds('mixed', source, [], { nativeAttributes: true, compactIndex: true });
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(result.glb).buffer, ''), loaded: Mesh[] = [];
  gltf.scene.traverse(node => { if (isMesh(node)) loaded.push(node); });
  const group = bakedMeshKindsGroup(new Map(result.kinds.map((row, i) => {
    const mesh = loaded[i]; if (mesh === undefined) throw new Error('Missing test mesh'); return [row.name, mesh];
  })), result.kinds);
  expect(group.children).toHaveLength(3);
  source.forEach(([, expected], i) => {
    const actual = group.children[i]; if (!isMesh(actual)) throw new Error('Missing restored mesh');
    expect(actual instanceof InstancedMesh).toBe(expected instanceof InstancedMesh);
    expect(Array.isArray(actual.material) ? null : actual.material.type).toBe(expected.material.type);
    for (const [key, channel] of Object.entries(expected.geometry.attributes)) expect(actual.geometry.getAttribute(key).array).toStrictEqual(channel.array);
    expect(actual.geometry.getIndex()?.array ?? null).toStrictEqual(expected.geometry.getIndex()?.array ?? null);
    if (isInstanced(actual) && isInstanced(expected)) expect(actual.instanceMatrix.array).toStrictEqual(expected.instanceMatrix.array);
    else expect(actual.matrix.elements).toStrictEqual(expected.matrixWorld.elements);
    if (!(actual.material instanceof MeshStandardMaterial) && !(actual.material instanceof MeshBasicMaterial)) throw new Error('Wrong material family');
    expect(actual.material.color.toArray()).toStrictEqual(expected.material.color.toArray());
    if (actual.material instanceof MeshStandardMaterial && expected.material instanceof MeshStandardMaterial) {
      expect(actual.material.emissive.toArray()).toStrictEqual(expected.material.emissive.toArray());
      expect(actual.material.roughness).toBe(expected.material.roughness);
      expect(actual.material.flatShading).toBe(expected.material.flatShading);
    }
  });
  expect(loaded[1]?.material).toBeInstanceOf(MeshBasicMaterial);
});

it('bakes basic material declarations and round-trips scene JSON without quantizing HDR colour', () => {
  const scene = new Scene(), material = new MeshBasicMaterial({ color: 0xffb24a }); material.color.multiplyScalar(3.2);
  scene.add(new BakedPiece('glass', [['glass', new Mesh(new BoxGeometry(), material)]], [], { nativeAttributes: true, compactIndex: true }));
  expect(bake(scene, { slug: 'basic-test' }).pieces[0]?.kinds[0]?.['unlit']).toBe(true);
  const description = readScene(scene); expect(readScene(restoreSceneGraph(description))).toStrictEqual(description);
});

it('refuses unsupported ordinary storage/state and a missing exact transform', () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  expect(bakeKinds('glass', [['glass', mesh]], []).kinds[0]?.['mesh']).toBe(true);
  mesh.material.transparent = true;
  expect(() => bakeKinds('glass', [['glass', mesh]], [], { nativeAttributes: true, compactIndex: true })).toThrow('unsupported ordinary material state');
  mesh.material.transparent = false; mesh.material.map = new Texture();
  expect(() => bakeKinds('glass', [['glass', mesh]], [], { nativeAttributes: true, compactIndex: true })).toThrow('textures must be external');
  const instances = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
  expect(() => bakeKinds('glass', [['glass', instances]], [])).toThrow('unlit kinds require');
  expect(() => bakedMeshKindsGroup(new Map([['glass', mesh]]), [{ name: 'glass', mesh: true, unlit: true, count: 1, color: 0xffffff,
    roughness: 1, metalness: 0, flat: false, emissive: 0, emissiveIntensity: 1, vertexColors: false, doubleSided: false,
    colorR: 1, colorG: 1, colorB: 1 }])).toThrow('missing exact transform');
});


it('refuses state that ordinary rows cannot represent, instead of silently changing a draw', () => {
  const make = (): Mesh<BoxGeometry, MeshBasicMaterial> => new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  for (const change of [
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.visible = false; },
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.castShadow = true; },
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.geometry.setDrawRange(0, 3); },
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.material.colorWrite = false; },
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.material.alphaHash = true; },
    (mesh: Mesh<BoxGeometry, MeshBasicMaterial>) => { mesh.material.onBeforeCompile = () => undefined; },
  ]) {
    const mesh = make(); change(mesh);
    expect(() => bakeKinds('glass', [['glass', mesh]], [])).toThrow(/unsupported ordinary|callbacks/u);
  }
});
