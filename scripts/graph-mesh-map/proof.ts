/** Untimed GPU oracle: two original maps in one frame share one catalogue graph program. */
import { DataTexture, Mesh, NearestFilter, NoToneMapping, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
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
    const result = { first, swapped, firstPrograms, programs, compiled: client.graphs.readout.compiled,
      pass: JSON.stringify(first) === JSON.stringify(expected) && JSON.stringify(swapped) === JSON.stringify([...expected].reverse()) && firstPrograms === 1 && programs === 1 && client.graphs.readout.compiled === 1 };
    if (!result.pass) throw new Error(JSON.stringify(result));
    return result;
  } finally { scope.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = { pass: false, error: error instanceof Error ? error.message : String(error) }; }
Reflect.set(window, 'meshMapProof', result);
document.body.append(Object.assign(document.createElement('pre'), { textContent: JSON.stringify(result) }));
