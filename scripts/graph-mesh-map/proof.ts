/** Untimed GPU oracle: two original maps in one frame share one catalogue graph program. */
import { Color, DataTexture, InstancedMesh, Matrix4, Mesh, NearestFilter, NoToneMapping, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../../src/sdk/author';
import { graph, meshMap } from '../../src/sdk/materials';

async function prove(): Promise<unknown> {
  const canvas = document.getElementById('proof');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing oracle canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(128, 64, false); renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = SRGBColorSpace;
  const scope = new Scope('graph-mesh-map-oracle');
  const source = emptyShardfile({ slug: 'map-oracle', name: 'Map oracle', author: 'proof', seed: 1, revision: 1 });
  Object.assign(source.look.materials, { mapped: { family: 'graph', graph: graph({ model: 'unlit', surface: { colour: meshMap.rgb, alpha: meshMap.a } }) } });
  const texture = (rgba: number[]): DataTexture => {
    const map = scope.own(new DataTexture(new Uint8Array(rgba), 1, 1, RGBAFormat));
    map.colorSpace = SRGBColorSpace; map.magFilter = NearestFilter; map.minFilter = NearestFilter; map.needsUpdate = true;
    return map;
  };
  const red = texture([255, 0, 0, 255]), green = texture([0, 255, 0, 255]);
  try {
    const client = await clientMaterials(source, new Map(), renderer, scope, { graphs: true });
    const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;
    const geometry = scope.own(new PlaneGeometry(1, 1));
    const left = new Mesh(geometry, client.bindMeshMap('mapped', red)), right = new Mesh(geometry, client.bindMeshMap('mapped', green));
    left.position.x = -0.5; right.position.x = 0.5; scene.add(left, right);
    const read = (): number[][] => {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const pixel = (x: number): number[] => { const bytes = new Uint8Array(4); gl.readPixels(x, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes]; };
      return [pixel(32), pixel(96)];
    };
    const first = read(), firstPrograms = renderer.info.programs?.length ?? 0;
    left.material = client.bindMeshMap('mapped', green); right.material = client.bindMeshMap('mapped', red);
    const swapped = read(), programs = renderer.info.programs?.length ?? 0;
    const expected = [[255, 0, 0, 255], [0, 255, 0, 255]];
    const plainPass = JSON.stringify(first) === JSON.stringify(expected) && JSON.stringify(swapped) === JSON.stringify([...expected].reverse()) && firstPrograms === 1 && programs === 1;
    scene.clear();
    const small = scope.own(new PlaneGeometry(0.14, 0.3));
    const counts = [3, 5, 2];
    const meshes: InstancedMesh[] = [];
    let ordinal = 0;
    for (const [group, count] of counts.entries()) {
      const mesh = new InstancedMesh(small, client.bindMeshMap('mapped', group === 1 ? green : red), count);
      for (let i = 0; i < count; i++) mesh.setMatrixAt(i, new Matrix4().makeTranslation(-0.9 + 0.2 * ordinal++, 0, 0));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; meshes.push(mesh); scene.add(mesh);
    }
    const readInstances = (): number[][] => {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      return Array.from({length: 10}, (_, i) => {
        const pixel = new Uint8Array(4); gl.readPixels(Math.floor((0.1 + 0.2 * i) * 64), 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel];
      });
    };
    const instanced = readInstances(), instancedPrograms = renderer.info.programs?.length ?? 0;
    for (const [i, mesh] of meshes.entries()) mesh.material = client.bindMeshMap('mapped', i === 1 ? red : green);
    const instanceSwap = readInstances(), swapPrograms = renderer.info.programs?.length ?? 0;
    const instanceExpected = Array.from({length: 10}, (_, i) => i >= 3 && i < 8 ? expected[1] : expected[0]);
    const swapExpected = Array.from({length: 10}, (_, i) => i >= 3 && i < 8 ? expected[0] : expected[1]);
    ordinal = 0;
    for (const mesh of meshes) {
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, new Matrix4().makeTranslation(-0.9 + 0.2 * ordinal++, 0.25, 0));
      mesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const sample = (i: number, y: number): number[] => { const bytes = new Uint8Array(4); gl.readPixels(Math.floor((0.1 + 0.2 * i) * 64), y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes]; };
    const moved = Array.from({length: 10}, (_, i) => sample(i, 48));
    const vacated = Array.from({length: 10}, (_, i) => sample(i, 32));
    scene.clear();
    const white = texture([255, 255, 255, 255]);
    // Above the stock matrix UBO limit, only two visible instances are drawn.
    // The same reserved attributes must work at every allocation size.
    const large = new InstancedMesh(small, client.bindMeshMap('mapped', white), 1100);
    large.count = 2; large.frustumCulled = false;
    large.setMatrixAt(0, new Matrix4().makeTranslation(-0.9, 0, 0));
    large.setMatrixAt(1, new Matrix4().makeTranslation(-0.7, 0, 0));
    large.setColorAt(0, new Color(1, 0, 0)); large.setColorAt(1, new Color(0, 1, 0));
    large.instanceMatrix.needsUpdate = true;
    scene.add(large); renderer.render(scene, camera);
    const colours = [sample(0, 32), sample(1, 32)];
    large.setColorAt(0, new Color(0, 1, 0)); large.setColorAt(1, new Color(1, 0, 0));
    if (large.instanceColor === null) throw new Error('Missing instance colours');
    large.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
    const colourSwap = [sample(0, 32), sample(1, 32)];
    const finalPrograms = renderer.info.programs?.length ?? 0;
    for (const mesh of meshes) mesh.dispose(); large.dispose();
    const result = { first, swapped, firstPrograms, programs, instanced, instanceSwap, instancedPrograms, swapPrograms, moved, vacated, colours, colourSwap, finalPrograms, compiled: client.graphs.readout.compiled,
      pass: plainPass && JSON.stringify(instanced) === JSON.stringify(instanceExpected) && JSON.stringify(instanceSwap) === JSON.stringify(swapExpected) && JSON.stringify(moved) === JSON.stringify(swapExpected) && vacated.every(pixel => JSON.stringify(pixel) === '[0,0,0,255]') && JSON.stringify(colours) === JSON.stringify(expected) && JSON.stringify(colourSwap) === JSON.stringify([...expected].reverse()) && instancedPrograms === 2 && swapPrograms === 2 && finalPrograms === 3 && client.graphs.readout.compiled === 1 };
    if (!result.pass) throw new Error(JSON.stringify(result));
    return result;
  } finally { scope.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = { pass: false, error: error instanceof Error ? error.message : String(error) }; }
Reflect.set(window, 'meshMapProof', result);
document.body.append(Object.assign(document.createElement('pre'), { textContent: JSON.stringify(result) }));
