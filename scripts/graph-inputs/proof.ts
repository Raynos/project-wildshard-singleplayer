/** Untimed real-renderer oracle for additive graph inputs. */
import { Bone, DirectionalLight, Float32BufferAttribute, LinearSRGBColorSpace, Mesh, NoToneMapping, OrthographicCamera, PlaneGeometry, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, WebGLRenderer } from 'three';
import { dot, max, vec3 } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Scope } from '../../src/engine/app/scope';
import type { AnimalMaterial } from '../../src/engine/entities/AnimalFactory';
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
    Object.assign(source.look.materials, { animal: { family: 'graph', graph: graph({ model: 'standard',
      effectState: { fog: false }, surface: { colour: vec3(0), emissive: vec3(1, 0, 0) } }) } });
    Object.assign(source.look.materials, { view: { family: 'graph', graph: graph({ model: 'unlit', effectState: {fog: false},
      surface: {colour: vec3(graphInputs.positionView.x.div(3).add(0.5), graphInputs.positionView.z.mul(-0.125), 0)} }) } });
    Object.assign(source.look.materials, { skyLight: { family: 'graph', graph: graph({model: 'unlit', effectState: {fog: false},
      surface: {colour: graphInputs.skyLightColour.mul(max(dot(graphInputs.skyLightDirection,vec3(0,0,1)),0))} }) } });
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
    const alphaPass = pixels.every((pixel, i) => pixel.slice(0, 3).every(value => Math.abs(value - (expected[i] ?? -1000)) <= 1) && pixel[3] === 255)
      && gl.getError() === gl.NO_ERROR;
    if (!alphaPass) throw new Error(JSON.stringify({pixels, expected}));
    const compiled = client.materials.get('animal');
    if (!(compiled instanceof MeshStandardNodeMaterial)) throw new Error('Missing compiled lit body material');
    const body: AnimalMaterial = compiled;
    scene.clear();
    const animal = new Mesh(scope.own(new PlaneGeometry(1, 1)), body); scene.add(animal);
    renderer.render(scene, camera);
    const animalPixel = new Uint8Array(4); gl.readPixels(96, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, animalPixel);
    const animalPass = animalPixel[0] === 255 && animalPixel[1] === 0 && animalPixel[2] === 0 && animalPixel[3] === 255 && gl.getError() === gl.NO_ERROR;
    if (!animalPass) throw new Error(JSON.stringify({animalPixel: Array.from(animalPixel)}));
    scene.clear();
    const skinGeometry = scope.own(new PlaneGeometry(0.6, 0.6));
    skinGeometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(16), 4));
    skinGeometry.setAttribute('skinWeight', new Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 4));
    const skin = new SkinnedMesh(skinGeometry, body), bone = new Bone();
    skin.add(bone); skin.position.x = -1; skin.frustumCulled = false; scene.add(skin); scene.updateMatrixWorld(true);
    const skeleton = scope.own(new Skeleton([bone])); skin.bind(skeleton);
    const skinPixels = (): number[][] => {
      renderer.render(scene, camera);
      return [32, 160].map(x => { const words = new Uint8Array(4); gl.readPixels(x, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, words); return Array.from(words); });
    };
    const skinRest = skinPixels(); bone.position.x = 2; const skinMoved = skinPixels();
    const red = [255,0,0,255], black = [0,0,0,255];
    const skinPass = JSON.stringify(skinRest) === JSON.stringify([red,black]) && JSON.stringify(skinMoved) === JSON.stringify([black,red]) && gl.getError() === gl.NO_ERROR;
    if (!skinPass) throw new Error(JSON.stringify({skinRest,skinMoved}));
    scene.clear();
    const viewMaterial = client.materials.get('view');
    if (viewMaterial === undefined) throw new Error('Missing view-position graph');
    scene.add(new Mesh(scope.own(new PlaneGeometry(10, 5)), viewMaterial));
    const viewPixels: number[][] = [];
    for (const [x,z] of [[0,2],[0.75,4]]) {
      camera.position.set(x,0,z); renderer.render(scene,camera);
      const words = new Uint8Array(4); gl.readPixels(96,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,words); viewPixels.push(Array.from(words));
    }
    const viewPass = viewPixels.every((pixel,i) => Math.abs((pixel[0] ?? -1000)-128) <= 1 && Math.abs((pixel[1] ?? -1000)-(i === 0 ? 64 : 128)) <= 1 && pixel[2] === 0 && pixel[3] === 255) && gl.getError() === gl.NO_ERROR;
    if (!viewPass) throw new Error(JSON.stringify({viewPixels}));
    scene.clear(); camera.position.set(0,0,2);
    const lightMaterial = client.materials.get('skyLight');
    if (lightMaterial === undefined) throw new Error('Missing directional sky-light graph');
    scene.add(new Mesh(scope.own(new PlaneGeometry(1,1)),lightMaterial));
    const fill = new DirectionalLight(0xff0000,0.5), sun = new DirectionalLight(0x0000ff,0.25);
    fill.position.set(0,0,1); sun.position.set(0,0,1); sun.castShadow = true; scene.add(fill,sun,fill.target,sun.target);
    const lightPixels: number[][] = [];
    const readLight = (): void => {
      renderer.render(scene,camera); const words = new Uint8Array(4); gl.readPixels(96,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,words); lightPixels.push(Array.from(words));
    };
    readLight(); sun.color.setRGB(0,1,0); sun.intensity = 1; sun.position.set(1,0,0); readLight();
    sun.position.set(0,0,2); sun.target.position.z = 1; readLight(); sun.visible = false; readLight(); fill.visible = false; readLight();
    const lightExpected = [[0,0,64,255],black,[0,255,0,255],[128,0,0,255],black];
    const pass = lightPixels.every((pixel,i) => pixel.every((value,j) => Math.abs(value-(lightExpected[i]?.[j] ?? -1000)) <= 1)) && gl.getError() === gl.NO_ERROR;
    if (!pass) throw new Error(JSON.stringify({lightPixels,lightExpected}));
    return { pass, vertexColourAlpha: {pixels, expected}, animalMaterial: Array.from(animalPixel), skinning: {skinRest,skinMoved}, positionView: viewPixels, skyLight: lightPixels };
  } finally { scope.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = {pass: false, error: error instanceof Error ? error.message : String(error)}; }
Reflect.set(window, 'graphInputsProof', result);
document.body.append(Object.assign(document.createElement('pre'), {textContent: JSON.stringify(result)}));
