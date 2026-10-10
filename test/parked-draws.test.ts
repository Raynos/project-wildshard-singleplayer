import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, WebGLRenderTarget, type Camera, type Object3D, type Texture, type Vector4 } from 'three';
import { parkedDrawSlices, warmParkedDraws, type ParkedDrawRenderer } from '../src/engine/render/parkedDraws';

const mesh = (material = new MeshStandardMaterial()): Mesh => new Mesh(new BoxGeometry(), material);

it('slices drawables by count and by materials no earlier slice drew', () => {
  const shared = new MeshStandardMaterial();
  const objects = [mesh(shared), mesh(shared), mesh(), mesh(), mesh(shared), mesh()];
  const slices = parkedDrawSlices(objects, { drawables: 3, newMaterials: 2 });
  expect(slices.map(slice => slice.length)).toEqual([3, 3]);
  expect(parkedDrawSlices(objects, { drawables: 8, newMaterials: 1 }).map(slice => slice.length)).toEqual([2, 1, 2, 1]);
  expect(parkedDrawSlices([], { drawables: 8, newMaterials: 2 })).toEqual([]);
});

it('draws only the parked root\'s visible drawables, with every light, into a 1x1 scissor, and restores all state', async () => {
  const scene = new Scene(), road = mesh(), root = new Group(), inner = new Group();
  const a = mesh(), b = mesh(), hidden = mesh(), offLayer = mesh(), cellLight = new PointLight(), sun = new PointLight();
  hidden.visible = false; offLayer.layers.set(9); offLayer.frustumCulled = true; a.frustumCulled = true;
  inner.add(b, hidden); root.add(a, inner, offLayer, cellLight); root.visible = false;
  scene.add(road, root, sun);
  const camera = new PerspectiveCamera(), target = new WebGLRenderTarget(64, 64), env: Texture | null = null;
  const seen: { drawn: Object3D[]; lights: Object3D[]; rootVisible: boolean; scissor: Vector4; scissorTest: boolean; shadowAuto: boolean; target: ReturnType<ParkedDrawRenderer['getRenderTarget']> }[] = [];
  let bound: ReturnType<ParkedDrawRenderer['getRenderTarget']> = null;
  const shadowMap = { autoUpdate: true, needsUpdate: true };
  const renderer: ParkedDrawRenderer = {
    shadowMap,
    render: (drawn: Object3D, view: Camera) => {
      const visible: Object3D[] = [], lights: Object3D[] = [];
      drawn.traverseVisible(object => {
        if (!object.layers.test(view.layers)) return;
        if (object instanceof PointLight) lights.push(object); else if (object instanceof Mesh) visible.push(object);
      });
      seen.push({ drawn: visible, lights, rootVisible: root.visible, scissor: target.scissor.clone(), scissorTest: target.scissorTest, shadowAuto: shadowMap.autoUpdate, target: bound });
    },
    getRenderTarget: () => bound, setRenderTarget: (next) => { bound = next === target ? target : null; },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: (out) => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  let pauses = 0;
  const drawn = await warmParkedDraws(renderer, scene, camera, target, root, () => true, () => { pauses++; return Promise.resolve(); },
    { budget: { drawables: 1, newMaterials: 1 }, environment: env });
  expect(drawn).toBe(2); expect(pauses).toBe(2);
  expect(seen.map(s => s.drawn)).toEqual([[a], [b]]);
  for (const s of seen) {
    expect(s.lights.sort((x, y) => x.id - y.id)).toEqual([cellLight, sun].sort((x, y) => x.id - y.id));
    expect(s.rootVisible).toBe(true); expect(s.scissor.toArray()).toEqual([0, 0, 1, 1]); expect(s.scissorTest).toBe(true);
    expect(s.shadowAuto).toBe(false); expect(s.target).toBe(target);
  }
  expect(root.visible).toBe(false); expect(bound).toBe(null);
  expect(target.scissor.toArray()).toEqual([0, 0, 64, 64]); expect(target.scissorTest).toBe(false);
  expect(shadowMap).toEqual({ autoUpdate: true, needsUpdate: true });
  expect(a.frustumCulled).toBe(true); expect(a.layers.mask).toBe(1); expect(cellLight.layers.mask).toBe(1); expect(offLayer.layers.mask).toBe(1 << 9);
  await expect(warmParkedDraws(renderer, scene, camera, target, root, () => false, () => Promise.resolve())).rejects.toThrow('Parked draw owner left');
});
