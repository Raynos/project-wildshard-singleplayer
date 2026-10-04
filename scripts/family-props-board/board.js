// SF9b / SF10a follow-up board (SHARD-PLATFORM, E435). A MEASUREMENT TOOL, NOT GAME CODE: bundled by
// scripts/family-props-board/run.mjs (vite), opened in one muted headless Chromium as the iPhone 16 Pro.
//
// Three rows, three frames each, same light and camera per row:
//   toon      Driftwood's sailboat as a declared-props GLB under the toon family
//   painterly a Nalati camp still life as a declared-props GLB under the painterly family
//   pool      the template shardfile's terrain tiles at the swim pool under the PBR family
// BEFORE is the old installer's per-mesh `clone()` (it drops the family's shader patches: plain shading) and, for the
// pool, today's smooth implicit PBR. AFTER is installDeclaredProps now (shared family variants) and the faceted PBR
// option. REFERENCE is the family material built directly on the source meshes (toon, painterly) or today's
// template terrainPainter (pool: flat-shaded). window.familyPropsBoard(kind) returns the three frames, AFTER vs
// REFERENCE pixel difference and the SF10a precompile reading for AFTER (family jobs, then programs the first draw built).
import * as THREE from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { modelContext } from '@wildshard/engine/models/model';
import { paintGeometry } from '@wildshard/engine/world/painterly';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { installDeclaredProps } from '@wildshard/engine/world/declaredProps';
import { installTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { familyCompileJobs, familyMaterial } from '@wildshard/engine/render/families/registry';
import { staticGlb } from '../../src/sdk/bake/glb';
import { boat } from '../../src/shards/driftwood-isle/models/boat';
import { TRAIL } from '../../src/shards/_template/layout';
import { poolMask } from '../../src/shards/_template/generators/world';
import source from '../../src/shards/_template/shard.config';

const W = 600, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.append(renderer.domElement);
const programs = () => (renderer.info.programs ?? []).length;

function grab(scene, camera) {
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (g === null) throw new Error('no 2d context');
  g.drawImage(renderer.domElement, 0, 0);
  return { url: c.toDataURL('image/png'), pixels: g.getImageData(0, 0, W, H).data };
}

function compare(a, b) {
  let sum = 0, over = 0, max = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    let px = 0;
    for (let k = 0; k < 3; k++) { const d = Math.abs(a[i + k] - b[i + k]); sum += d; px = Math.max(px, d); }
    if (px > 8) over++;
    max = Math.max(max, px);
  }
  return { mean: Math.round((sum / (n * 3)) * 1000) / 1000, over8: Math.round((over / n) * 10000) / 100, max };
}

/** the SF10a check: compile the family jobs as the loading screen does, then count programs the first draw still builds */
function precompiled(scene, camera) {
  const jobs = familyCompileJobs(scene, null);
  const before = programs();
  for (const job of jobs) renderer.compile(job.root, camera, job.target ?? undefined);
  const built = programs() - before, known = new Set(renderer.info.programs);
  const frame = grab(scene, camera);
  const fresh = renderer.info.programs.filter((p) => !known.has(p)).map((p) => p.name);
  return { frame, reading: { familyJobs: jobs.length, built, firstDraw: fresh.length, firstDrawPrograms: fresh } };
}

/** draw the row's non-family parts once (ground, sky, the shadow pass's depth program on a plain caster), so the first
 * AFTER draw counts only what the family path itself still compiles */
function warm(scene, camera, sides) {
  for (const g of Object.values(sides)) g.visible = false;
  const caster = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  caster.castShadow = true; caster.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 3);
  scene.add(caster);
  renderer.render(scene, camera);
  scene.remove(caster); caster.geometry.dispose(); caster.material.dispose();
}

/** one declared-props GLB of `root`'s meshes in world space (vertex colours and material numbers kept) */
function glbOf(root) {
  root.updateMatrixWorld(true);
  const primitives = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    const was = Array.isArray(o.material) ? o.material[0] : o.material;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const material = new THREE.MeshStandardMaterial({ color: was.color ?? new THREE.Color(1, 1, 1), roughness: was.roughness ?? 1, metalness: was.metalness ?? 0, side: was.side });
    primitives.push({ geometry, material });
  });
  return staticGlb(primitives, 'board');
}

/** BEFORE: the old installer's per-mesh clone of the family material (three's clone drops the shader patches) */
function plainClones(root) {
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); });
}

async function declared(file, family, material, scope) {
  const props = { family, tiles: [{ lod: 0, x: 0, z: 0, file: 'board' }], panels: [], models: [], far: null, textures: [] };
  const group = new THREE.Group();
  const installed = await installDeclaredProps(props, { scene: group, scope, assets: new Map([['board', file]]), materials: new Map([[family, material]]) });
  return { group, installed };
}

/** the three sides of one row, AFTER first so its precompile reading is clean */
function threeWay(scene, camera, sides) {
  const show = (k) => { for (const [name, g] of Object.entries(sides)) g.visible = name === k; };
  warm(scene, camera, sides);
  show('after');
  const { frame: after, reading } = precompiled(scene, camera);
  show('reference');
  const reference = grab(scene, camera);
  show('before');
  const before = grab(scene, camera);
  return { before: before.url, after: after.url, reference: reference.url, diff: { afterVsReference: compare(after.pixels, reference.pixels), beforeVsReference: compare(before.pixels, reference.pixels) }, precompile: reading };
}

async function toon() {
  renderer.toneMapping = THREE.AgXToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc4f0);
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.97, 0.9), 2.7);
  sun.position.set(-4, 9, 5).normalize().multiplyScalar(30);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008;
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 70 });
  scene.add(sun, new THREE.HemisphereLight(0x7b90f4, 0xe8b890, 1.15));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9d3a0, roughness: 0.95, flatShading: true }));
  ground.receiveShadow = true; scene.add(ground);
  const look = new ToonLook({ lift: [0.08, 0.05, 0.13], rim: [1.3, 0.95, 0.6], cloudShade: { strength: 0.32, scale: 60, wind: [3.2, 1.4] } });
  const scope = new Scope('family-props-board.toon');
  const ctx = { toon: look, textures: () => { throw new Error('toon takes no textures'); }, scope };
  const lightDir = new THREE.Vector3(-4, 9, 5).normalize().negate();
  const build = boat.build(modelContext({ csm: { lightDirection: lightDir }, setupMaterial: () => undefined }), {}, () => 0.5);
  build.rotation.y = 0.75;
  const family = familyMaterial({ family: 'toon' }, ctx);
  const file = glbOf(build);
  // REFERENCE: the toon family built directly per source material (its numbers, its side), on the source meshes
  build.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    const was = o.material, m = familyMaterial({ family: 'toon', roughness: was.roughness, metalness: was.metalness, doubleSided: was.side === THREE.DoubleSide, vertexColours: o.geometry.hasAttribute('color') }, ctx);
    m.color.copy(was.color);
    o.material = m;
  });
  const after = await declared(file, 'toon', family, scope), before = await declared(file, 'toon', family, scope);
  plainClones(before.group);
  scene.add(build, after.group, before.group);
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
  camera.position.set(-3.4, 4.2, 11.5); camera.lookAt(0, 1.6, 0);
  const r = threeWay(scene, camera, { after: after.group, before: before.group, reference: build });
  scope.dispose();
  return r;
}

async function painterly() {
  renderer.toneMapping = THREE.NoToneMapping;
  const SHADE = [0.1, 0.16, 0.36], RIM = [1.5, 1.28, 0.95];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9c4dc');
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.85, 0.64), 3.0);
  sun.position.set(-7, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  scene.add(sun, new THREE.HemisphereLight(new THREE.Color(0.55, 0.62, 0.85), new THREE.Color(0.32, 0.3, 0.16), 1.0));
  const look = new PainterlyLook({ shade: SHADE, rim: RIM, wind: { direction: [1, 0.35], strength: 1 } });
  const scope = new Scope('family-props-board.painterly');
  const ctx = { toon: new ToonLook(), painterly: look, textures: () => { throw new Error('no maps here'); }, scope };
  // the camp still life (SF10a's painterly row): a yurt, a door, a boulder, a spruce, a chest, on painted grass
  const life = new THREE.Group();
  const add = (geo, at) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true })); m.position.set(...at); m.castShadow = true; m.receiveShadow = true; life.add(m); return m; };
  add(paintGeometry(new THREE.PlaneGeometry(24, 24, 24, 24).rotateX(-Math.PI / 2), '#8f9a4c', 0.12, 3), [0, 0, 0]);
  const wall = paintGeometry(new THREE.CylinderGeometry(2.1, 2.2, 1.6, 28, 3, true), '#ece2cc', 0.05, 5);
  const col = wall.getAttribute('color'), pos = wall.getAttribute('position');
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i)) < 0.3) col.setXYZ(i, 0.62, 0.1, 0.07);
  add(wall, [0.6, 0.8, -1.2]);
  add(paintGeometry(new THREE.SphereGeometry(2.25, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), '#e4d8bd', 0.04, 7), [0.6, -0.69, -1.2]).scale.set(1, 1.9, 1);
  add(paintGeometry(new THREE.BoxGeometry(0.8, 1.2, 0.1), '#3a2418', 0.05, 9), [1.35, 0.6, 0.75]).rotation.y = 0.35;
  add(paintGeometry(new THREE.DodecahedronGeometry(0.9, 1), '#2f3540', 0.18, 11), [-2.4, 0.5, 1.4]).scale.set(1.3, 0.8, 1);
  add(paintGeometry(new THREE.ConeGeometry(0.9, 3.2, 9, 4).translate(0, 1.6, 0), '#3f6b3a', 0.12, 13), [-3.4, 0, -3.4]);
  add(paintGeometry(new THREE.BoxGeometry(0.9, 0.55, 0.55), '#9a2a1c', 0.06, 15), [-0.6, 0.28, 1.9]).rotation.y = -0.4;
  const family = familyMaterial({ family: 'painterly' }, ctx);
  const file = glbOf(life);
  // REFERENCE: one painterly family material built directly, on the source meshes
  const direct = familyMaterial({ family: 'painterly' }, ctx);
  life.traverse((o) => { if (o instanceof THREE.Mesh) o.material = direct; });
  const after = await declared(file, 'painterly', family, scope), before = await declared(file, 'painterly', family, scope);
  plainClones(before.group);
  scene.add(life, after.group, before.group);
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
  camera.position.set(-1.6, 3.2, 10.5); camera.lookAt(0.2, 1.1, -0.6);
  const r = threeWay(scene, camera, { after: after.group, before: before.group, reference: life });
  scope.dispose();
  return r;
}

async function pool() {
  renderer.toneMapping = THREE.NoToneMapping;
  const key = source.look.keys[0];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(...key.sky.horizon);
  scene.fog = new THREE.Fog(new THREE.Color().setRGB(...key.fog.colour), key.fog.near, key.fog.far);
  const elevation = source.look.day.maxElevation * Math.PI / 180, azimuth = source.look.day.azimuth * Math.PI / 180;
  const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(...key.sun.colour), key.sun.intensity);
  sun.position.set(25 + Math.cos(elevation) * Math.sin(azimuth) * 100, Math.sin(elevation) * 100, 20 + Math.cos(elevation) * Math.cos(azimuth) * 100);
  sun.target.position.set(25, 0, 20);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 });
  scene.add(sun, sun.target, new THREE.HemisphereLight(new THREE.Color().setRGB(...key.ambient.sky), new THREE.Color().setRGB(...key.ambient.ground), key.ambient.intensity));
  const scope = new Scope('family-props-board.pool');
  const ctx = { toon: new ToonLook(), textures: () => { throw new Error('no maps here'); }, scope };
  // the loader's implicit PBR surface (clientMaterials): vertex-coloured, dielectric; AFTER adds the faceted option
  const smooth = familyMaterial({ family: 'pbr', vertexColours: true, metalness: 0 }, ctx);
  const faceted = familyMaterial({ family: 'pbr', vertexColours: true, metalness: 0, faceted: true }, ctx);
  const near = source.tiles.filter((t) => t.lod === 0 && t.bounds.min[0] < 75 && t.bounds.max[0] > -25 && t.bounds.min[2] < 70 && t.bounds.max[2] > -30);
  const before = new THREE.Group(), after = new THREE.Group();
  for (const row of near) {
    const tile = source.terrain?.tiles.find((t) => t.lod === row.lod && t.x === row.x && t.z === row.z);
    if (tile === undefined) continue;
    const bytes = new Uint8Array(await (await fetch(`./template-assets/${tile.file}`)).arrayBuffer());
    installTerrainTile(bytes, { root: before, scope, material: smooth, shadow: true });
    installTerrainTile(bytes, { root: after, scope, material: faceted, shadow: true });
  }
  // REFERENCE: today's template terrainPainter (src/shards/_template/look/render.ts) on the legacy field
  const field = buildTerrain(357, { landscape: (x, z, { n }) => poolMask(x, z) ? -3 : n.get(x * 0.015, z * 0.015) * 0.5, trails: TRAIL, cabinSites: [] });
  const plane = new THREE.PlaneGeometry(200, 200, 40, 40); plane.rotateX(-Math.PI / 2);
  const p = plane.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, field.heightAt(p.getX(i), p.getZ(i)));
  plane.computeVertexNormals();
  const today = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ color: 0x7e8388, flatShading: true })); today.receiveShadow = true;
  const reference = new THREE.Group(); reference.add(today);
  scene.add(before, after, reference);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 400);
  camera.position.set(38, 13, 38); camera.lookAt(25, -2, 19);
  const r = threeWay(scene, camera, { after, before, reference });
  scope.dispose();
  return { ...r, tiles: near.length };
}

window.familyPropsBoard = (kind) => (kind === 'toon' ? toon() : kind === 'painterly' ? painterly() : pool());
