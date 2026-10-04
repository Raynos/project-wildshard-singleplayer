// SF9c's playback harness (SHARD-PLATFORM §4 F1 SF9c, the playback half). A MEASUREMENT TOOL, NOT GAME CODE: bundled by
// scripts/skin-playback/run.mjs (vite), opened in one muted headless Chromium as an iPhone 16 Pro. Each creature is drawn
// twice under the same light and camera, stacked for the portrait phone frame:
//   TODAY     the procedural original as the client builds it now: the template's grey blob and the kit boar from the
//             species factory and their Animal pose (lowPolyMaterials), the ranger from Pine Hollow's own NpcModels
//             (ranger.phone.glb, its atlas + normal map material, npcRig.ts's pose closure)
//   EXPORTED  the content-addressed GLB of public/assets/baked/skin-fixture/ through the client's skin player
//             (src/game/shardfile/skinPlayback.ts: admission, GLTFLoader, bindRig, AnimMachine) with its bindings.json
//             SF10a family material; the ranger's maps are the baked KTX2 files transcoded by three's KTX2Loader
// Today steps its closure at 60 Hz, the export advances its mixer by 1/60 s (the engine's per-frame update); every second
// step is a video frame. window.skinPlayback exposes: init(), segments(), frame(i) → { jpeg, err }, still(kind, clip, t).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { Scope } from '@wildshard/engine/app/scope';
import { BASIS_PATH } from '@wildshard/engine/core/ktx2';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import { loadSkin, parseSkinBindings, parseSkinRows } from '../../src/game/shardfile/skinPlayback';
import { NpcModels } from '../../src/shards/pine-hollow/quest/npcModels';
import { creatureSkinSource } from '../../test/fixtures/sim-level/skins/sources';

const W = 540, H = 960, HEAD = 120, GAP = 8, PANEL = (H - HEAD - GAP - 40) / 2;
const NAMES = { 'grey-blob': 'Template grey blob', boar: 'Kit boar', 'pine-ranger': 'Pine ranger (Hale)' };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setScissorTest(true);
document.body.append(renderer.domElement);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const overlay = document.createElement('canvas'); overlay.width = W; overlay.height = H; const g2 = overlay.getContext('2d');

function stage() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb4c4); scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x5a5040, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(3, 6, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); sun.shadow.bias = -0.0005;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x7d8a5c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  return scene;
}

const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
const fetchBytes = async (path) => new Uint8Array(await (await fetch(path)).arrayBuffer());
const DIR = '/assets/baked/skin-fixture/';
let rows, bindings; const textures = new Map(), creatures = {};

async function exported(kind) {
  const row = rows.find((r) => r.id === kind), binding = bindings.find((b) => b.skin === kind);
  const material = familyMaterial(binding.material, { toon: new ToonLook(), scope: new Scope(`skin-${kind}`), textures: (ref) => { const t = textures.get(ref); if (!t) throw new Error(`texture ${ref} not preloaded`); return t; } });
  return { row, binding, skin: await loadSkin(await fetchBytes(DIR + row.file), row, binding, material) };
}
async function today(kind) {
  if (kind !== 'pine-ranger') { const s = creatureSkinSource(kind); return { mesh: s.mesh, pose: s.pose, dispose: () => { s.dispose(); } }; }
  // Pine Hollow's own people loader, on the phone hull the export read
  const models = new NpcModels(() => loadRigFile('/assets/pine-hollow/npcs/ranger.phone.glb'));
  await models.load('ranger');
  const rig = models.rig('ranger', { setupMaterial: (material) => { material.needsUpdate = true; } });   // no sky in the harness
  return { mesh: rig.mesh, pose: (clip, t) => rig.pose(t, clip === 'idle.talk' ? 1 : 0, clip === 'idle.point' ? 1 : 0, 0.4, 0.2, clip === 'walk' ? 1 : 0, t % 1), dispose: () => { rig.mesh.skeleton.dispose(); } };
}

async function init() {
  rows = parseSkinRows(await (await fetch(`${DIR}skins.json`)).json());
  bindings = parseSkinBindings(await (await fetch(`${DIR}bindings.json`)).json(), rows);
  for (const b of bindings) for (const [use, ref] of Object.entries(b.material.maps ?? {})) if (typeof ref === 'string' && !textures.has(ref)) {
    const bytes = await fetchBytes(DIR + ref);
    const tex = await new Promise((resolve, reject) => { ktx2.parse(bytes.buffer, resolve, reject); });
    tex.flipY = false; tex.colorSpace = use === 'colour' ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.needsUpdate = true;
    textures.set(ref, tex);
  }
  for (const kind of ['grey-blob', 'boar', 'pine-ranger']) {
    const a = stage(), b = stage(), old = await today(kind), neu = await exported(kind);
    a.add(old.mesh); b.add(neu.skin.root);
    old.mesh.geometry.computeBoundingBox(); const box = old.mesh.geometry.boundingBox.clone().applyMatrix4(old.mesh.matrixWorld);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(30, W / PANEL, 0.05, 50), reach = Math.max(size.x, size.y * 1.2, size.z) * 1.9 + 0.4;
    camera.position.set(centre.x + reach * 0.62, centre.y + reach * 0.32, centre.z + reach * 0.78); camera.lookAt(centre.x, centre.y * 0.85, centre.z);
    creatures[kind] = { a, b, old, neu, camera, clips: neu.row.rig.clips, loops: neu.binding.loops, verts: old.mesh.geometry.getAttribute('position').count };
  }
  return { rows: rows.map((r) => ({ id: r.id, clips: r.rig.clips, cost: r.cost })), textures: [...textures.keys()] };
}

// the video's timeline: per creature, per clip: a looping clip twice round (its seam shows), a one-shot once + a 0.5 s hold
let timeline = null;
function segments() {
  timeline = [];
  for (const kind of ['grey-blob', 'boar', 'pine-ranger']) for (const clip of creatures[kind].clips) {
    const duration = creatures[kind].neu.skin.rig.clips.get(clip).duration, loop = creatures[kind].loops.includes(clip);
    timeline.push({ kind, clip, duration, loop, steps: Math.round((loop ? duration * 2 : duration + 0.5) * 60) });
  }
  return timeline.map((s) => ({ kind: s.kind, clip: s.clip, duration: s.duration, loop: s.loop, frames: s.steps / 2 }));
}

let seg = -1, step = 0;
const errOf = (c) => {
  let worst = 0; const p = new THREE.Vector3(), q = new THREE.Vector3();
  c.a.updateMatrixWorld(true); c.b.updateMatrixWorld(true);
  for (let i = 0; i < c.verts; i += 5) { c.old.mesh.getVertexPosition(i, p).applyMatrix4(c.old.mesh.matrixWorld); c.neu.skin.mesh.getVertexPosition(i, q).applyMatrix4(c.neu.skin.mesh.matrixWorld); worst = Math.max(worst, p.distanceTo(q)); }
  return worst;
};
function begin(i) {
  seg = i; step = 0; const s = timeline[i], c = creatures[s.kind];
  // a fresh original per clip (its closure keeps attack / stagger / death state), like the export sampled it
  if (c.old.mesh.parent) c.old.mesh.parent.remove(c.old.mesh);
  return today(s.kind).then((old) => { c.old.dispose(); c.old = old; c.a.add(old.mesh); old.pose(s.clip, 0, 0); c.neu.skin.play(s.clip); return old; });
}
function advance(s, c) {
  const end = Math.round(s.duration * 60);
  if (!s.loop && step >= end) return;             // a one-shot holds its last frame on both sides
  step++;
  c.old.pose(s.clip, step / 60, 1 / 60); c.neu.skin.update(1 / 60);
}
function draw(s, c, t, err) {
  const top = HEAD, bottom = HEAD + PANEL + GAP;
  renderer.setViewport(0, H - top - PANEL, W, PANEL); renderer.setScissor(0, H - top - PANEL, W, PANEL); renderer.render(c.a, c.camera);
  renderer.setViewport(0, H - bottom - PANEL, W, PANEL); renderer.setScissor(0, H - bottom - PANEL, W, PANEL); renderer.render(c.b, c.camera);
  g2.fillStyle = '#16181c'; g2.fillRect(0, 0, W, H); g2.drawImage(renderer.domElement, 0, 0);
  g2.fillStyle = '#16181c'; g2.fillRect(0, 0, W, HEAD); g2.fillRect(0, HEAD + PANEL, W, GAP); g2.fillRect(0, H - 40, W, 40);
  g2.fillStyle = '#f0f0f0'; g2.font = 'bold 26px Helvetica, Arial'; g2.fillText(NAMES[s.kind], 16, 40);
  g2.fillStyle = '#e8d9a8'; g2.font = 'bold 34px Helvetica, Arial'; g2.fillText(s.clip, 16, 84);
  g2.fillStyle = '#aab0ba'; g2.font = '20px Helvetica, Arial';
  const clipT = s.loop ? t % s.duration : Math.min(t, s.duration);
  g2.fillText(`${s.loop ? 'loop' : 'once'} · ${clipT.toFixed(2)} / ${s.duration.toFixed(2)} s`, W - 16 - g2.measureText(`${s.loop ? 'loop' : 'once'} · ${clipT.toFixed(2)} / ${s.duration.toFixed(2)} s`).width, 84);
  g2.fillText('SF9c · today vs exported GLB', W - 16 - g2.measureText('SF9c · today vs exported GLB').width, 40);
  for (const [y, label] of [[top, 'TODAY · procedural closure'], [bottom, 'EXPORTED · GLB + AnimMachine']]) {
    g2.font = 'bold 20px Helvetica, Arial'; const w = g2.measureText(label).width;
    g2.fillStyle = 'rgba(0,0,0,0.65)'; g2.fillRect(8, y + 8, w + 16, 30); g2.fillStyle = '#ffffff'; g2.fillText(label, 16, y + 30);
  }
  g2.font = '18px Helvetica, Arial'; g2.fillStyle = err < 1e-4 ? '#9fd59f' : '#f0b070';
  g2.fillText(`max vertex gap ${err < 1e-4 ? '< 0.1 mm' : `${(err * 1000).toFixed(0)} mm (looped: today runs on)`}`, 16, H - 14);
}
async function frame(i) {
  // i indexes the whole video; find the segment and step two engine frames
  let k = 0, f = i; while (k < timeline.length && f >= timeline[k].steps / 2) { f -= timeline[k].steps / 2; k++; }
  const s = timeline[k], c = creatures[s.kind];
  if (k !== seg) { await begin(k); } else { advance(s, c); advance(s, c); }
  const err = errOf(c);
  draw(s, c, step / 60, err);
  return { jpeg: overlay.toDataURL('image/jpeg', 0.9), err, kind: s.kind, clip: s.clip, t: step / 60 };
}

// a still pair (full-resolution square) for the board: each side alone at clip time t, and the pixel difference
async function still(kind, clip, t, size) {
  const c = creatures[kind];
  if (c.old.mesh.parent) c.old.mesh.parent.remove(c.old.mesh);
  const old = await today(kind); c.old.dispose(); c.old = old; c.a.add(old.mesh); old.pose(clip, 0, 0); c.neu.skin.play(clip);
  const n = Math.round(t * 60); for (let i = 1; i <= n; i++) { old.pose(clip, i / 60, 1 / 60); c.neu.skin.update(1 / 60); }
  const err = errOf(c);
  renderer.setScissorTest(false); renderer.setSize(size, size); const cam = c.camera.clone(); cam.aspect = 1; cam.updateProjectionMatrix();
  const shot = (scene) => { renderer.setViewport(0, 0, size, size); renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png'); };
  const pixels = (scene) => { renderer.render(scene, cam); const gl = renderer.getContext(), buf = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };
  const a = shot(c.a), pa = pixels(c.a), b = shot(c.b), pb = pixels(c.b);
  let sum = 0, max = 0, over = 0;
  for (let i = 0; i < pa.length; i += 4) for (let ch = 0; ch < 3; ch++) { const d = Math.abs(pa[i + ch] - pb[i + ch]); sum += d; max = Math.max(max, d); if (d > 8) over++; }
  renderer.setSize(W, H); renderer.setScissorTest(true);
  return { today: a, exported: b, err, diff: { mean: Number((sum / (size * size * 3)).toFixed(3)), max, over8: Number((100 * over / (size * size * 3)).toFixed(3)) } };
}

window.skinPlayback = { init, segments, frame, still };
