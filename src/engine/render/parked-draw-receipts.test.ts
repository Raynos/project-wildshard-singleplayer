import { expect, test } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, PCFShadowMap, PerspectiveCamera, Scene, Vector4, WebGLRenderTarget,
  type Camera, type Material, type Object3D } from 'three';
import { LIVE_PARKED_BUDGET, warmParkedDraws, type ParkedDrawBudget, type ParkedDrawRenderer } from './parkedDraws';

const ONE_A_SLICE: ParkedDrawBudget = { drawables: 1, newMaterials: 1 };

/** A renderer double with three's property store: a draw gives each drawn material (of `materials`) a current program. */
function fixture(materials: readonly Material[]) {
  const scene = new Scene(), camera = new PerspectiveCamera(), root = new Group();
  scene.add(camera, root); root.visible = false;
  const target = new WebGLRenderTarget(4, 4), scissor = new Vector4();
  const properties = new WeakMap<object, { currentProgram?: { id: number } }>();
  let current: WebGLRenderTarget | null = null, scissorTest = false, program = 1;
  const draws: Object3D[][] = [];
  const renderer: ParkedDrawRenderer & { properties: { get: (object: object) => { currentProgram?: { id: number } } } } = {
    properties: { get: object => { let row = properties.get(object); if (row === undefined) { row = {}; properties.set(object, row); } return row; } },
    render: (world: Object3D, view: Camera) => {
      const drawn: Object3D[] = [];
      world.traverseVisible(object => {
        if (!(object instanceof Mesh) || !object.layers.test(view.layers)) return;
        drawn.push(object);
        for (const material of materials) if (object.material === material) renderer.properties.get(material).currentProgram ??= { id: program++ };
      });
      draws.push(drawn);
    },
    shadowMap: { autoUpdate: true, needsUpdate: false, type: PCFShadowMap },
    getRenderTarget: () => current, setRenderTarget: value => { current = value; },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: value => value.copy(scissor), setScissor: () => undefined,
    getScissorTest: () => scissorTest, setScissorTest: value => { scissorTest = value; },
  };
  const warm = async (budget: ParkedDrawBudget = ONE_A_SLICE): Promise<{ drawn: number; pauses: number }> => {
    let pauses = 0;
    const drawn = await warmParkedDraws(renderer, scene, camera, target, root, () => true, () => { pauses++; return Promise.resolve(); }, { budget });
    return { drawn, pauses };
  };
  return { root, draws, warm, dispose: () => { target.dispose(); } };
}

test('a later parked warm of the same pipelines draws nothing new; a fresh geometry still draws', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), other = new BoxGeometry(), f = fixture([material]);
  try {
    f.root.add(new Mesh(geometry, material), new InstancedMesh(geometry, material, 2));
    expect(await f.warm()).toEqual({ drawn: 2, pauses: 1 });
    // the destination is parked again with new wrappers over the same library geometry and material
    f.root.clear(); f.root.add(new Mesh(geometry, material));
    expect(await f.warm()).toEqual({ drawn: 0, pauses: 0 });
    f.root.add(new Mesh(other, material));
    expect((await f.warm()).drawn).toBe(1);
  } finally { f.dispose(); geometry.dispose(); other.dispose(); material.dispose(); }
});

test('a new instance buffer, a disposed material or a disposed geometry keeps its warm draw', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), f = fixture([material]);
  try {
    f.root.add(new InstancedMesh(geometry, material, 2));
    expect((await f.warm()).drawn).toBe(1);
    f.root.clear(); f.root.add(new InstancedMesh(geometry, material, 2)); // same layout, its own instance matrices
    expect((await f.warm()).drawn).toBe(1);
    f.root.clear(); const mesh = new Mesh(geometry, material); f.root.add(mesh);
    expect((await f.warm()).drawn).toBe(1);
    expect((await f.warm()).drawn).toBe(0);
    material.dispose();
    expect((await f.warm()).drawn).toBe(1);
    geometry.dispose();
    expect((await f.warm()).drawn).toBe(1);
  } finally { f.dispose(); geometry.dispose(); material.dispose(); }
});

test('a live WebKit budget gives each first-use binding its own completed frame; copies share it', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), f = fixture([material]);
  try {
    f.root.add(...Array.from({ length: 20 }, () => new InstancedMesh(geometry, material, 1)));
    // slices of 8, 8, 4: the first holds the binding's first use and ends its frame; the two copy slices share the next
    const { drawn, pauses } = await f.warm(LIVE_PARKED_BUDGET);
    expect(drawn).toBe(20);
    expect(pauses).toBe(2);
    expect(f.draws.map(slice => slice.length)).toEqual([8, 8, 4]);
  } finally { f.dispose(); geometry.dispose(); material.dispose(); }
});
