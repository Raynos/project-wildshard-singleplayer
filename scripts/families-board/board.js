// SF10a's material-family board harness (SHARD-PLATFORM §4 F1 SF10a). A MEASUREMENT TOOL, NOT GAME CODE: bundled by
// scripts/families-board/run.mjs (vite), opened in one muted headless Chromium. Each shard's reference prop is drawn
// twice under the same light, camera and ground: TODAY (the material the shard builds now) and FAMILY (the engine's
// material family from renderer-neutral parameters). window.familiesBoard(kind) returns both frames, the pixel
// difference and the precompile reading (programs the family jobs built, programs the first family draw still built).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Scope } from '@wildshard/engine/app/scope';
import { modelContext } from '@wildshard/engine/models/model';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { patchSway } from '@wildshard/engine/world/wind';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { familyCompileJobs, familyMaterial } from '@wildshard/engine/render/families/registry';
import { boat } from '../../src/shards/driftwood-isle/models/boat';
import { installRampFog, installToonLighting, toonUniforms } from '../../src/shards/driftwood-isle/look/toon';
import { part2 } from './part2';

const SIZE = 900;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.append(renderer.domElement);
const programs = () => (renderer.info.programs ?? []).length;

function grab(scene, camera) {
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const g = c.getContext('2d');
  if (g === null) throw new Error('no 2d context');
  g.drawImage(renderer.domElement, 0, 0);
  return { url: c.toDataURL('image/png'), pixels: g.getImageData(0, 0, SIZE, SIZE).data };
}

function compare(a, b) {
  let sum = 0, sq = 0, over = 0, max = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    let px = 0;
    for (let k = 0; k < 3; k++) { const d = Math.abs((a[i + k] ?? 0) - (b[i + k] ?? 0)); sum += d; sq += d * d; px = Math.max(px, d); }
    if (px > 8) over++;
    max = Math.max(max, px);
  }
  const mse = sq / (n * 3);
  return { mean: Math.round((sum / (n * 3)) * 1000) / 1000, over8: Math.round((over / n) * 10000) / 100, max, psnr: mse === 0 ? Infinity : Math.round(10 * Math.log10((255 * 255) / mse) * 10) / 10 };
}

/** compile the family jobs as the loading screen's shader step does, then count what the first family draw still builds */
function precompiled(scene, camera, draw) {
  const jobs = familyCompileJobs(scene, null);
  const before = programs();
  for (const job of jobs) renderer.compile(job.root, camera, job.target ?? undefined);
  const built = programs() - before;
  const atDraw = programs();
  const frame = draw();
  return { frame, reading: { familyJobs: jobs.length, built, firstDraw: programs() - atDraw } };
}

/** the faceted toon shard's sailboat: its lowpoly materials under the page-wide toon patch, then toon-family materials */
function toon(golden) {
  installToonLighting();
  installRampFog();
  const preset = golden
    ? { sun: new THREE.Color(1.0, 0.72, 0.45), sunI: 2.5, hemiSky: 0x7a7ce0, hemiGround: 0xe0a070, hemiI: 0.85, lift: [0.1, 0.03, 0.2] , rim: [1.6, 0.9, 0.45] , cloud: 0.28, dir: new THREE.Vector3(-6, 3.2, 4) }
    : { sun: new THREE.Color(1.0, 0.97, 0.9), sunI: 2.7, hemiSky: 0x7b90f4, hemiGround: 0xe8b890, hemiI: 1.15, lift: [0.08, 0.05, 0.13] , rim: [1.3, 0.95, 0.6] , cloud: 0.32, dir: new THREE.Vector3(-4, 9, 5) };
  // today's uniforms (the shard's day clock writes these) and the family look (a runtime adapter would write these)
  toonUniforms.uToonLift.value.setRGB(...preset.lift);
  toonUniforms.uToonRim.value.setRGB(...preset.rim);
  toonUniforms.uCloudShadow.value = preset.cloud;
  const look = new ToonLook({ lift: preset.lift, rim: preset.rim, cloudShade: { strength: preset.cloud, scale: 60, wind: [3.2, 1.4] } });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(golden ? 0xe8a878 : 0x9cc4f0);
  const sun = new THREE.DirectionalLight(preset.sun, preset.sunI);
  sun.position.copy(preset.dir).normalize().multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 70 });
  sun.shadow.normalBias = 0; // the kit's shadow-normal flip (E112) only steers the normal bias: off for both sides
  sun.shadow.bias = -0.0008;
  scene.add(sun, new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiI));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9d3a0, roughness: 0.95, flatShading: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  const lightDir = new THREE.Vector3().copy(preset.dir).normalize().negate();
  const sky = { csm: { lightDirection: lightDir }, setupMaterial: () => undefined };
  // a measurement stub: the lowpoly kit reads only the sky's light direction and its setupMaterial
  const ctx = modelContext(sky);
  const build = boat.build(ctx, {}, () => 0.5);
  if (!(build instanceof THREE.Object3D)) throw new Error('the boat builds an Object3D');
  build.rotation.y = 0.75;
  scene.add(build);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(-2.8, 3.6, 9.4);
  camera.lookAt(0, 1.6, 0);

  const today = grab(scene, camera);
  // the family side: every lowpoly material → the toon family; the kit's sway stays on as a decoration (shape, not shade)
  const scope = new Scope('families-board');
  const fctx = { toon: look, textures: () => { throw new Error('toon takes no textures'); }, scope };
  const notes = [];
  const swapped = new Map();
  build.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    const was = o.material;
    let fam = swapped.get(was);
    if (fam === undefined) {
      fam = familyMaterial({ family: 'toon', doubleSided: was.side === THREE.DoubleSide, roughness: was.roughness, metalness: was.metalness, vertexColours: was.vertexColors, faceted: was.flatShading }, fctx);
      patchShader(fam, 'board.kit-decoration', PATCH_ORDER.decorate, (sh) => { attachFogUniforms(sh); patchSway(sh); }, { key: (k) => `${k}|kit` });
      swapped.set(was, fam);
      notes.push(`${was.name || 'lowpoly'} side=${was.side} rough=${was.roughness} → toon`);
    }
    o.material = fam;
  });
  const { frame, reading } = precompiled(scene, camera, () => grab(scene, camera));
  // control: the family's look really drives the frame (no rim, no lift, flat shade grade → it must differ)
  look.set({ rim: [0, 0, 0], lift: [0, 0, 0], terminator: [0, 0, 0] });
  const control = compare(today.pixels, grab(scene, camera).pixels);
  notes.push(`control (family look with rim, lift and terminator zeroed): mean ${control.mean}, ${control.over8}% of pixels off by > 8`);
  scope.dispose();
  return { today: today.url, family: frame.url, diff: compare(today.pixels, frame.pixels), precompile: reading, notes };
}

/** the photoreal shard's wine barrel: the glTF scan's materials (slots filled as its sky rig does), then PBR-family ones */
async function pbr() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fa7b8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(-3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 20 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, new THREE.HemisphereLight(0xbcd0e0, 0x5a4a3a, 0.5));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const gltf = await new GLTFLoader().loadAsync('/assets/models/wine_barrel_01/wine_barrel_01.gltf');
  const prop = gltf.scene;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); flat.needsUpdate = true;
  const notes = [];
  prop.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) if (t) t.anisotropy = 8;
    m.map ??= white; m.normalMap ??= flat; m.aoMap ??= white; m.roughnessMap ??= white; m.metalnessMap ??= white; // SkyRig.fillSlots
    m.needsUpdate = true;
  });
  prop.rotation.y = 0.6;
  scene.add(prop);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  camera.position.set(1.7, 1.25, 1.9);
  camera.lookAt(0, 0.42, 0);
  const today = grab(scene, camera);

  // the family side: the same three files as texture references, resolved the way a shardfile loader will (glTF UVs)
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const pending = [];
  const scope = new Scope('families-board');
  const fctx = {
    toon: new ToonLook(), scope,
    textures: (ref, use) => {
      const key = `${ref}|${use}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const t = new THREE.Texture();
      pending.push(loader.loadAsync(ref).then((loaded) => { t.image = loaded.image; t.needsUpdate = true; return t; }));
      t.flipY = false; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (use === 'colour') t.colorSpace = THREE.SRGBColorSpace;
      cache.set(key, t);
      return t;
    },
  };
  const dir = '/assets/models/wine_barrel_01/textures/wine_barrel_01';
  prop.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    const was = o.material;
    notes.push(`gltf: rough=${was.roughness} metal=${was.metalness} normalScale=${was.normalScale.x},${was.normalScale.y} side=${was.side} aoMap=${was.aoMap === white ? 'filler' : 'file'}`);
    o.material = familyMaterial({ family: 'pbr', maps: { colour: `${dir}_diff_1k.jpg`, normal: `${dir}_nor_gl_1k.jpg`, orm: `${dir}_arm_1k.jpg` }, roughness: was.roughness, metalness: was.metalness, normalScale: was.normalScale.x, occlusion: 0, doubleSided: was.side === THREE.DoubleSide }, fctx);
  });
  await Promise.all(pending);
  const { frame, reading } = precompiled(scene, camera, () => grab(scene, camera));
  // control: the family's parameters really drive the frame (half the normal strength → it must differ)
  const famMats = new Set();
  prop.traverse((o) => { if (o instanceof THREE.Mesh) famMats.add(o.material); });
  for (const m of famMats) m.normalScale.multiplyScalar(0.5);
  const control = compare(today.pixels, grab(scene, camera).pixels);
  notes.push(`control (family normal strength halved): mean ${control.mean}, ${control.over8}% of pixels off by > 8`);
  scope.dispose();
  return { today: today.url, family: frame.url, diff: compare(today.pixels, frame.pixels), precompile: reading, notes };
}

/** @param {'toon-midday' | 'toon-golden' | 'pbr' | 'painterly' | 'neon'} kind */
window.familiesBoard = (kind) => {
  const p2 = part2(renderer, SIZE);
  switch (kind) {
    case 'pbr': return pbr();
    case 'painterly': return Promise.resolve(p2.painterly());
    case 'neon': return Promise.resolve(p2.neon());
    case 'toon-golden': return Promise.resolve(toon(true));
    case 'toon-midday': return Promise.resolve(toon(false));
    default: return Promise.reject(new Error(`unknown panel ${String(kind)}`));
  }
};
