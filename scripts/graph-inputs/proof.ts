/** Untimed real-renderer oracle for additive graph inputs. */
import { Float32BufferAttribute, LinearSRGBColorSpace, Mesh, NoToneMapping, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { vec3 } from 'three/tsl';
import { Scope } from '../../src/engine/app/scope';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../../src/sdk/author';
import { graph, graphInputs } from '../../src/sdk/materials';

async function prove(): Promise<unknown> {
  const canvas = document.getElementById('proof');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing oracle canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(192, 64, false); renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
  const scope = new Scope('graph-inputs-oracle');
  try {
    const source = emptyShardfile({ slug: 'inputs-oracle', name: 'Inputs oracle', author: 'proof', seed: 1, revision: 1 });
    Object.assign(source.look.materials, { alpha: { family: 'graph', graph: graph({ model: 'unlit',
      effectState: { fog: false }, surface: { colour: vec3(graphInputs.vertexColourAlpha, graphInputs.vertexColourAlpha, graphInputs.vertexColourAlpha) } }) } });
    const client = await clientMaterials(source, new Map(), renderer, scope, { graphs: true });
    const material = client.materials.get('alpha');
    if (material === undefined) throw new Error('Missing alpha graph');
    const scene = new Scene(), camera = new OrthographicCamera(-1.5, 1.5, 0.5, -0.5, 0.1, 10); camera.position.z = 2;
    for (const [ordinal, width] of [4, 3, 0].entries()) {
      const geometry = scope.own(new PlaneGeometry(1, 1));
      if (width > 0) {
        const words = Array.from({length: 4}, () => width === 4 ? [1, 1, 1, 0.25] : [1, 1, 1]).flat();
        geometry.setAttribute('color', new Float32BufferAttribute(words, width));
      }
      const mesh = new Mesh(geometry, material); mesh.position.x = ordinal - 1; scene.add(mesh);
    }
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixels = [32, 96, 160].map(x => {
      const bytes = new Uint8Array(4); gl.readPixels(x, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return Array.from(bytes);
    });
    const expected = [64, 255, 255];
    const pass = pixels.every((pixel, i) => pixel.slice(0, 3).every(value => Math.abs(value - (expected[i] ?? -1000)) <= 1) && pixel[3] === 255)
      && gl.getError() === gl.NO_ERROR;
    if (!pass) throw new Error(JSON.stringify({pixels, expected}));
    return { pass, vertexColourAlpha: {pixels, expected} };
  } finally { scope.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = {pass: false, error: error instanceof Error ? error.message : String(error)}; }
Reflect.set(window, 'graphInputsProof', result);
document.body.append(Object.assign(document.createElement('pre'), {textContent: JSON.stringify(result)}));
