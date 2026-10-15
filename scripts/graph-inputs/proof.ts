import { uniformTransport } from './uniforms';
/** Untimed real-renderer oracle for additive graph inputs. */
import { programVariants } from './variants';
import { Bone, CubeTexture, DataArrayTexture, DataTexture, DirectionalLight, Float32BufferAttribute, LinearSRGBColorSpace, Mesh, NearestFilter, NoToneMapping, OrthographicCamera, PlaneGeometry, PMREMGenerator, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, WebGLRenderer } from 'three';
import { attribute, dot, max, uv, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Scope } from '../../src/engine/app/scope';
import type { AnimalMaterial } from '../../src/engine/entities/AnimalFactory';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../../src/sdk/author';
import { environmentIrradianceAt, graph, graphInputs, param, sample, sampleArray } from '../../src/sdk/materials';

async function prove(): Promise<unknown> {
  const canvas = document.getElementById('proof');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing oracle canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(192, 64, false); renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
  const scope = new Scope('graph-inputs-oracle');
  try {
    const source = emptyShardfile({ slug: 'inputs-oracle', name: 'Inputs oracle', author: 'proof', seed: 1, revision: 1 });
    Object.assign(source.look.materials, { alpha: { family: 'graph', graph: graph({ model: 'unlit',
      surface: { colour: vec3(graphInputs.vertexColourAlpha, graphInputs.vertexColourAlpha, graphInputs.vertexColourAlpha) } }) } });
    Object.assign(source.look.materials, { animal: { family: 'graph', graph: graph({ model: 'standard',
      surface: { colour: vec3(0), emissive: vec3(1, 0, 0) } }) } });
    Object.assign(source.look.materials, { view: { family: 'graph', graph: graph({ model: 'unlit', surface: {colour: vec3(graphInputs.positionView.x.div(3).add(0.5), graphInputs.positionView.z.mul(-0.125), 0)} }) } });
    Object.assign(source.look.materials, { skyLight: { family: 'graph', graph: graph({model: 'unlit', surface: {colour: graphInputs.skyLightColour.mul(max(dot(graphInputs.skyLightDirection,vec3(0,0,1)),0))} }) } });
    const layers = param('layers',{type: 'texture', value: 'array-slot', role: 'lent'});
    Object.assign(source.look.materials, { array: {family: 'graph', graph: graph({model: 'unlit', surface: {colour: sampleArray(layers,uv(),attribute('aLayer','float')).rgb} })} });
    Object.assign(source.look.materials, { tint: {family: 'graph', graph: graph({model: 'unlit', surface: {colour: graphInputs.materialColour}})} });
    Object.assign(source.look.materials, { flash: {family: 'graph', graph: graph({model: 'standard', surface: {colour: vec3(0), emissive: graphInputs.materialEmissive}})} });
    const direction = param('direction', {type: 'vec3', value: [0, 1, 0]});
    Object.assign(source.look.materials, {
      environmentAt: {family: 'graph', graph: graph({model: 'standard', surface: {colour: vec3(1)},
        lighting: {sun: vec3(0), ambient: environmentIrradianceAt(direction).mul(1 / Math.PI)}})},
      environmentNormal: {family: 'graph', graph: graph({model: 'standard', surface: {colour: vec3(1)},
        lighting: {sun: vec3(0), ambient: graphInputs.environmentIrradiance.mul(1 / Math.PI)}})},
    });
    let refusedDirection = false, refusedPlace = false;
    try { graph({model: 'standard', lighting: {sun: vec3(0), ambient: environmentIrradianceAt(1)}}); }
    catch (error: unknown) { refusedDirection = error instanceof Error && error.message.includes('vec3 direction'); }
    try { graph({model: 'unlit', surface: {colour: environmentIrradianceAt(vec3(0, 1, 0))}}); }
    catch (error: unknown) { refusedPlace = error instanceof Error && error.message.includes('environmentIrradianceAt'); }
    if (!refusedDirection || !refusedPlace) throw new Error('Directional irradiance must refuse wrong input types/stages');
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
    for (const [x,z] of [[0,2],[0.75,4]] as const) {
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
    const lightPass = lightPixels.every((pixel,i) => pixel.every((value,j) => Math.abs(value-(lightExpected[i]?.[j] ?? -1000)) <= 1)) && gl.getError() === gl.NO_ERROR;
    if (!lightPass) throw new Error(JSON.stringify({lightPixels,lightExpected}));
    scene.clear();
    const arrayMaterial = client.materials.get('array');
    if (arrayMaterial === undefined) throw new Error('Missing array-sample graph');
    for (const [i,layer] of [0,1,0].entries()) {
      const geometry = scope.own(new PlaneGeometry(1,1)); geometry.setAttribute('aLayer',new Float32BufferAttribute(new Float32Array(4).fill(layer),1));
      const mesh = new Mesh(geometry,arrayMaterial); mesh.position.x = i-1; scene.add(mesh);
    }
    const readArray = (): number[][] => {
      renderer.render(scene,camera);
      return [32,96,160].map(x => {const words = new Uint8Array(4); gl.readPixels(x,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,words); return Array.from(words);});
    };
    const unset = readArray();
    let refused2d = false, refusedMixed = false;
    try {client.setTexture('array','layers',scope.own(new DataTexture(new Uint8Array([255,0,0,255]),1,1)));}
    catch (error: unknown) {refused2d = error instanceof Error && error.message.includes('requires a 2D texture array');}
    try {graph({model: 'unlit',surface: {colour: sample(layers,uv()).rgb.add(sampleArray(layers,uv(),0).rgb)}});}
    catch (error: unknown) {refusedMixed = error instanceof Error && error.message.includes('cannot mix 2D and array');}
    const arrayTexture = (words: number[]): DataArrayTexture => {
      const texture = scope.own(new DataArrayTexture(new Uint8Array(words),1,1,2)); texture.minFilter = NearestFilter; texture.magFilter = NearestFilter; texture.needsUpdate = true; return texture;
    };
    client.setTexture('array','layers',arrayTexture([255,0,0,255,0,255,0,255]));
    const firstArray = readArray(), arrayPrograms = renderer.info.programs?.length ?? 0;
    client.setTexture('array','layers',arrayTexture([0,0,255,255,255,255,0,255]));
    const swappedArray = readArray(), swappedPrograms = renderer.info.programs?.length ?? 0;
    const pass = unset.every(pixel => JSON.stringify(pixel) === JSON.stringify(black))
      && JSON.stringify(firstArray) === JSON.stringify([red,[0,255,0,255],red])
      && JSON.stringify(swappedArray) === JSON.stringify([[0,0,255,255],[255,255,0,255],[0,0,255,255]])
      && refused2d && refusedMixed && arrayPrograms === swappedPrograms && gl.getError() === gl.NO_ERROR;
    if (!pass) throw new Error(JSON.stringify({unset,firstArray,swappedArray,refused2d,refusedMixed,arrayPrograms,swappedPrograms}));
    // the per-material ports: two clones of one tint graph differ by their own colour (one program); the flash graph's
    // emissive follows the material's emissive × intensity live (a creature's hit flash)
    scene.clear();
    const tintGraph = client.materials.get('tint'), flashGraph = client.materials.get('flash');
    if (!(tintGraph instanceof MeshStandardNodeMaterial) && !(tintGraph instanceof MeshBasicNodeMaterial)) throw new Error('Missing material-colour graph');
    if (!(flashGraph instanceof MeshStandardNodeMaterial)) throw new Error('Missing material-emissive graph');
    const tintA = scope.own(tintGraph.clone()), tintB = scope.own(tintGraph.clone()), flashBody: AnimalMaterial = flashGraph;
    tintA.color.setRGB(1, 0, 0); tintB.color.setRGB(0, 0.5, 0);
    for (const [i, m] of [tintA, tintB, flashBody].entries()) { const mesh = new Mesh(scope.own(new PlaneGeometry(1, 1)), m); mesh.position.x = i - 1; scene.add(mesh); }
    const readPorts = (): number[][] => { renderer.render(scene, camera); return [32, 96, 160].map(x => { const words = new Uint8Array(4); gl.readPixels(x, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, words); return Array.from(words); }); };
    flashBody.emissive.setRGB(0, 0, 0); const portsDark = readPorts(), portPrograms = renderer.info.programs?.length ?? 0;
    flashBody.emissive.setRGB(1, 1, 1); flashBody.emissiveIntensity = 0.5; const portsFlash = readPorts();
    const near = (got: readonly number[][], want: readonly number[][]): boolean => want.every((pixel, i) => pixel.every((value, j) => Math.abs(value - (got[i]?.[j] ?? -1000)) <= 1));
    const portsPass = near(portsDark, [red, [0, 128, 0, 255], black]) && near(portsFlash, [red, [0, 128, 0, 255], [128, 128, 128, 255]])
      && portPrograms === (renderer.info.programs?.length ?? -1) && gl.getError() === gl.NO_ERROR;
    if (!portsPass) throw new Error(JSON.stringify({portsDark, portsFlash}));
    // One anisotropic environment: sky red above, blue below, green at the horizon.
    // Compare directions and the existing normal input, never implementation-number goldens.
    const faces = ['#00ff00', '#00ff00', '#ff0000', '#0000ff', '#00ff00', '#00ff00'].map(colour => {
      const face = document.createElement('canvas'); face.width = 16; face.height = 16;
      const paint = face.getContext('2d'); if (paint === null) throw new Error('Missing environment canvas context');
      paint.fillStyle = colour; paint.fillRect(0, 0, 16, 16); return face;
    });
    const cube = scope.own(new CubeTexture(faces)); cube.needsUpdate = true;
    const pmrem = scope.own(new PMREMGenerator(renderer)), environment = scope.own(pmrem.fromCubemap(cube));
    const directionalMaterial = client.materials.get('environmentAt'), normalMaterial = client.materials.get('environmentNormal');
    if (!(directionalMaterial instanceof MeshStandardNodeMaterial) || !(normalMaterial instanceof MeshStandardNodeMaterial)) throw new Error('Missing environment graphs');
    scene.clear(); scene.environment = environment.texture;
    const environmentMesh = new Mesh(scope.own(new PlaneGeometry(1, 1)), directionalMaterial); scene.add(environmentMesh);
    const readEnvironment = (): number[] => {
      renderer.render(scene, camera); const bytes = new Uint8Array(4); gl.readPixels(96, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return Array.from(bytes);
    };
    const above = readEnvironment(); client.setParam('environmentAt', 'direction', [0, -1, 0]); const below = readEnvironment();
    client.setParam('environmentAt', 'direction', [0, 0, 2]); const atNormal = readEnvironment();
    environmentMesh.material = normalMaterial; const legacyNormal = readEnvironment();
    environmentMesh.material = directionalMaterial; scene.environmentIntensity = 0.5; const dimmed = readEnvironment();
    scene.environment = null; const noEnvironment = readEnvironment();
    const environmentPass = (above[0] ?? 0) > (above[2] ?? 255) + 20 && (below[2] ?? 0) > (below[0] ?? 255) + 20
      && atNormal.every((value, i) => Math.abs(value - (legacyNormal[i] ?? -1000)) <= 2)
      && dimmed.slice(0, 3).every((value, i) => Math.abs(value * 2 - (atNormal[i] ?? -1000)) <= 3)
      && noEnvironment.slice(0, 3).every(value => value <= 1) && gl.getError() === gl.NO_ERROR;
    if (!environmentPass) throw new Error(JSON.stringify({above, below, atNormal, legacyNormal, dimmed, noEnvironment}));
    const variants = await programVariants(renderer, scope);
    const uniforms = uniformTransport(renderer, scope);
    return { pass, uniforms, environmentIrradianceAt: {above, below, atNormal, legacyNormal, dimmed, noEnvironment, refusedDirection, refusedPlace}, variants, materialPorts: {portsDark, portsFlash}, vertexColourAlpha: {pixels, expected}, animalMaterial: Array.from(animalPixel), skinning: {skinRest,skinMoved}, positionView: viewPixels, skyLight: lightPixels,
      textureArray: {unset,firstArray,swappedArray,refused2d,refusedMixed,arrayPrograms,swappedPrograms} };
  } finally { scope.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = {pass: false, error: error instanceof Error ? error.message : String(error)}; }
Reflect.set(window, 'graphInputsProof', result);
document.body.append(Object.assign(document.createElement('pre'), {textContent: JSON.stringify(result)}));
