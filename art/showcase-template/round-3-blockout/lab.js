// Showcase Template grey blockout lab, ROUND 3: builds the measured layout in layout.js as dev-map blocks and frames the
// captures (plan board, budget board, aerial, ground views at 1.7 m eye height). window.lab.show(name) for capture.mjs.
// R3 (Jake 11-03): the hub is a walled town on the west; NE = bands 1-4; SE = bands 5-6 over the gauntlet and the Titan.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REAL, HALF, STRIP, AVENUE_HALF, TOWN, PLAZA, ROAD, SEAM_X, GATES, ROAD_GATES, SE_WALL, ZONES, INTERIORS, SECRETS, HUB,
  BEACONS, BANDS, GATE_ELITES, ELITES, ELITE_LAIR_R, LOOKOUT, GOLD, GRIND, CONTRACTS, ARCHES } from './layout.js';
import { place as placeContent, budget, inZone, zoneArea, coverReach, grind, onScreen } from './placement.js';


const EYE = 1.7;
const C = { floor: 0xbfc2c5, orange: 0xe2782c, orangeDark: 0xb85d1e, grey: 0x8f9499, dark: 0x5a5f65, asphalt: 0x4d5257,
  light: 0xdcdedf, water: 0x4f93bd, ice: 0xeef6fb, grass: 0x8f9c79, hazard: 0xc8463c, cyan: 0x2fbfd3, bot: 0x6d7378,
  dirt: 0xa3957f, outside: 0x7c8186 };

// ---------- renderer, scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9c4dc);
scene.fog = new THREE.Fog(0xa9c4dc, 350, 1400);
scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x6b6660, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(-160, 300, 220); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 900 });
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.002; sun.shadow.normalBias = 0.4;
scene.add(sun);

// ---------- dev textures ----------
function gridTexture(base, minor, major, metres, px = 256) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, px, px);
  const step = px / metres; g.strokeStyle = minor; g.lineWidth = 1;
  for (let i = 1; i < metres; i++) { g.beginPath(); g.moveTo(i * step + .5, 0); g.lineTo(i * step + .5, px); g.moveTo(0, i * step + .5); g.lineTo(px, i * step + .5); g.stroke(); }
  g.strokeStyle = major; g.lineWidth = 3; g.strokeRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
}
const floorTex = gridTexture('#c3c6c9', '#aeb1b4', '#8d9094', 10);
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .92, metalness: 0, ...extra }); }
const M = {
  orange: mat(C.orange), orangeDark: mat(C.orangeDark), grey: mat(C.grey), dark: mat(C.dark), light: mat(C.light),
  asphalt: mat(C.asphalt), bot: mat(C.bot), hazard: mat(C.hazard), cyan: mat(C.cyan, { emissive: 0x0b4b55 }),
  water: mat(C.water, { transparent: true, opacity: .82, roughness: .2 }), ice: mat(C.ice, { transparent: true, opacity: .9 }),
  grass: mat(C.grass, { transparent: true, opacity: .9 }), dirt: mat(C.dirt), outside: mat(C.outside),
  white: mat(0xf4f4f2), glow: mat(0xffc35a, { emissive: 0xff9a2a, emissiveIntensity: .8 }),
  cone: new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }),
  portal: mat(0x3a7dff, { emissive: 0x2050ff, emissiveIntensity: .9 }),
  night: mat(0x26304a), elite: mat(0x7a2fb8, { emissive: 0x2a0a40 }), gold: mat(0xffc21a, { emissive: 0xb07800, emissiveIntensity: .8, metalness: .3 }),
  tank: mat(0xe8e6df), flame: new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: .5, depthWrite: false }),
};
const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a2c2e, transparent: true, opacity: .55 });

// ---------- helpers ----------
const world = new THREE.Group(); scene.add(world);
let target = world;
function place(fn, x, z, ry = 0) { const g = new THREE.Group(); target = g; fn(); g.rotation.y = ry; g.position.set(x, 0, z); world.add(g); target = world; }
function add(geo, m, x, y, z, o = {}) {
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
  if (o.ry) mesh.rotation.y = o.ry; if (o.rx) mesh.rotation.x = o.rx; if (o.rz) mesh.rotation.z = o.rz;
  mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
  if (o.edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat));
  (o.parent ?? target).add(mesh); return mesh;
}
// a box sitting on y (its base at y)
function box(w, h, d, x, y, z, m = M.orange, o = {}) { return add(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, { edges: true, ...o }); }
function cyl(rt, rb, h, x, y, z, m = M.orange, o = {}) { return add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20), m, x, y + h / 2, z, { edges: o.seg !== undefined && o.seg <= 8, ...o }); }
function flatRect(x0, x1, z0, z1, y, m, o = {}) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
  return add(g, m, (x0 + x1) / 2, y, (z0 + z1) / 2, { shadow: false, ...o });
}
function flatDisc(x, z, r, y, m, inner = 0, o = {}) {
  const g = inner > 0 ? new THREE.RingGeometry(inner, r, 96) : new THREE.CircleGeometry(r, 96); g.rotateX(-Math.PI / 2);
  return add(g, m, x, y, z, { shadow: false, ...o });
}
// a solid ring wall from a lathe profile; gaps = list of [centreAngle, width] in radians (angle 0 = +x, measured toward -z = north at +PI/2)
function ringWall(x, z, profile, m, gaps = []) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const cuts = gaps.map(([a, w]) => [a - w / 2, a + w / 2]).sort((p, q) => p[0] - q[0]);
  const spans = [];
  if (!cuts.length) spans.push([0, Math.PI * 2]);
  else for (let i = 0; i < cuts.length; i++) { const a = cuts[i][1], b = (cuts[(i + 1) % cuts.length][0]) + (i === cuts.length - 1 ? Math.PI * 2 : 0); spans.push([a, b - a]); }
  for (const [s, len] of spans) {
    // Lathe phi measures from +z toward +x; convert our math angle (from +x toward -z).
    const g = new THREE.LatheGeometry(pts, 64, Math.PI / 2 + s, len);
    add(g, m, x, 0, z, { edges: false });
  }
}
function capsule(x, z, h = 1.8, r = .35, m = M.bot) { return add(new THREE.CapsuleGeometry(r, h - 2 * r, 4, 10), m, x, h / 2, z); }
function wedge(len, h, w, x, z, ry, m = M.orange) { // ramp rising along its local +x
  const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(-len / 2, 0, -w / 2);
  return add(g, m, x, 0, z, { ry, edges: true });
}
function cable(points, color = 0x222222, r = .09) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  add(new THREE.TubeGeometry(curve, 64, r, 6), new THREE.MeshBasicMaterial({ color }), 0, 0, 0, { shadow: false });
}
function sag(a, b, drop, n = 12) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); } return out; }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// world-space 3D signs (stencil plates) for the ground views
const signList = [];
const signs = { set visible(v) { for (const sp of signList) sp.visible = v; } };
function sign(text, sub, x, y, z, w = 26) {
  const c = document.createElement('canvas'); c.width = 512; c.height = sub ? 150 : 104;
  const g = c.getContext('2d'); g.fillStyle = '#1b1d1fee'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ff9a4a'; g.fillRect(0, 0, c.width, 8);
  g.font = 'bold 54px Helvetica, Arial'; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(text, 256, 70);
  if (sub) { g.font = '34px Helvetica, Arial'; g.fillStyle = '#ffcf9e'; g.fillText(sub, 256, 124); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false, sizeAttenuation: false }));
  const k = .0042 * Math.min(w, 34) + .05; s.userData.k = [k, k * c.height / c.width]; s.scale.set(k, k * c.height / c.width, 1); s.position.set(x, y, z); target.add(s); signList.push(s); return s;
}



// ---------- the world ----------
function buildGround() {
  // the deck outside the cell: road gap (62.5 m), road on its centre line, neighbour cells beyond
  flatRect(-900, 900, -900, 900, -0.05, M.outside, { shadow: false });
  const roadC = HALF + 31.25;
  for (const s of [-1, 1]) {
    flatRect(-900, 900, s * roadC - 7.5, s * roadC + 7.5, 0.01, M.asphalt);
    flatRect(s * roadC - 7.5, s * roadC + 7.5, -900, 900, 0.01, M.asphalt);
  }
  for (const [cx, cz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = cx * (2 * HALF + 62.5), z = cz * (2 * HALF + 62.5);
    box(500, 0.6, 500, x, -0.4, z, M.grey, { edges: true, shadow: false });
    if (Math.abs(cx) + Math.abs(cz) === 1) sign('NEIGHBOUR CELL', '500 m shard, 62.5 m road gap', x - cx * 200, 14, z - cz * 200, 40);
  }
  // the cell floor: 1 m dev grid
  const g = new THREE.PlaneGeometry(500, 500); g.rotateX(-Math.PI / 2);
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(50, 50);
  add(g, new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), 0, 0, 0, { shadow: false });
  // R3 roads: perimeter strip, the seam avenue (N and S entries down the town's east wall to the east-gate apron),
  // the west avenue (west entry to the West Gate), the walled combat road (seam gate to the east entry)
  const y = 0.03;
  flatRect(-STRIP.outer, STRIP.outer, -STRIP.outer, -STRIP.inner, y, M.asphalt); flatRect(-STRIP.outer, STRIP.outer, STRIP.inner, STRIP.outer, y, M.asphalt);
  flatRect(-STRIP.outer, -STRIP.inner, -STRIP.inner, STRIP.inner, y, M.asphalt); flatRect(STRIP.inner, STRIP.outer, -STRIP.inner, STRIP.inner, y, M.asphalt);
  flatRect(TOWN.x1, ROAD.x0, -STRIP.inner, STRIP.inner, y, M.asphalt);
  flatRect(-STRIP.inner, TOWN.x0, -AVENUE_HALF, AVENUE_HALF, y, M.asphalt);
  flatRect(ROAD.x0, STRIP.inner, -ROAD.half, ROAD.half, y, M.asphalt);
  for (const s of [-1, 1]) { flatRect(-7.5, 7.5, s > 0 ? 235 : -262, s > 0 ? 262 : -235, 0.04, M.asphalt); flatRect(s > 0 ? 235 : -262, s > 0 ? 262 : -235, -7.5, 7.5, 0.04, M.asphalt); }
  // perimeter wall with the four 8 m midpoint entries and gate pylons
  const wl = HALF - 4 - 0.5;
  for (const s of [-1, 1]) for (const side of [-1, 1]) {
    box(wl, 5, 1, side * (4 + wl / 2), 0, s * 249.5, M.orange); box(1, 5, wl, s * 249.5, 0, side * (4 + wl / 2), M.orange);
    box(3, 9, 3, side * 5.5, 0, s * 248.5, M.orangeDark); box(3, 9, 3, s * 248.5, 0, side * 5.5, M.orangeDark);
  }
}

function buildRange() {   // local frame of round 2; placed rotated so the firing line runs along the town's south wall
  flatRect(-95, -20, -212, -112, 0.04, M.light);
  box(75, 1.1, 1.2, -57.5, 0, -120, M.orangeDark);
  for (let i = 0; i <= 5; i++) box(.5, 1.4, 76, -95 + i * 15, 0, -158, M.grey);
  const lanes = ['SWORD', 'SPEAR', 'BOW', 'CROSSBOW', 'LEVER RIFLE'];
  for (let l = 0; l < 5; l++) {
    const cx = -95 + 15 * (l + .5);
    if (l < 2) { capsule(cx - 3, -125, 1.9, .45, M.orange); capsule(cx + 3, -128, 1.9, .45, M.orange); capsule(cx, -132, 1.9, .45, M.hazard); }
    else for (let d = l === 4 ? 25 : 10; d <= (l === 4 ? 75 : 50); d += l === 4 ? 25 : 10) { box(1.4, .1, .2, cx, 0, -120 - d, M.grey); box(1.2, 1.6, .3, cx + (d % 20 ? 2 : -2), 0, -120 - d, M.white); }
    sign(lanes[l], '', cx, 4.5, -117, 10);
  }
  box(75, 10, 14, -57.5, 0, -205, M.grey);
  sign('02 WEAPON RANGE', '75×100 m · out of the Range Gate', -57.5, 16, -165, 34);
}

function stadiumPoint(cx, cz, halfLen, r, s) { // s in [0,1) around the stadium
  const per = 4 * halfLen + 2 * Math.PI * r; let d = s * per;
  if (d < 2 * halfLen) return [cx - halfLen + d, cz + r, 0];
  d -= 2 * halfLen; if (d < Math.PI * r) { const a = d / r; return [cx + halfLen + Math.sin(a) * r, cz + Math.cos(a) * r, a]; }
  d -= Math.PI * r; if (d < 2 * halfLen) return [cx + halfLen - d, cz - r, Math.PI];
  d -= 2 * halfLen; const a = Math.PI + d / r; return [cx - halfLen + Math.sin(a) * r, cz + Math.cos(a) * r, a];
}
function stadiumShape(cx, cz, halfLen, r) {
  const sh = new THREE.Shape(); const n = 96;
  for (let i = 0; i <= n; i++) { const [x, z] = stadiumPoint(cx, cz, halfLen, r, i / n); i ? sh.lineTo(x, -z) : sh.moveTo(x, -z); }
  return sh;
}
function buildRiding() {
  const { halfLen, radius, width } = REAL.oval, cx = 130, cz = -165;
  const outer = stadiumShape(cx, cz, halfLen, radius + width / 2), inner = stadiumShape(cx, cz, halfLen, radius - width / 2);
  outer.holes.push(inner);
  const g = new THREE.ShapeGeometry(outer, 8); g.rotateX(-Math.PI / 2);
  add(g, M.dirt, 0, 0.05, 0, { shadow: false });
  // rails: instanced posts and rails, both sides
  for (const r of [radius + width / 2 + .4, radius - width / 2 - .4]) {
    const per = 4 * halfLen + 2 * Math.PI * r, n = Math.round(per / 4);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, 1.4, .25), M.white, n);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(4, .15, .12), M.white, n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const [x, z] = stadiumPoint(cx, cz, halfLen, r, i / n), [x2, z2] = stadiumPoint(cx, cz, halfLen, r, (i + 1) / n);
      o.position.set(x, .7, z); o.rotation.set(0, 0, 0); o.updateMatrix(); posts.setMatrixAt(i, o.matrix);
      o.position.set((x + x2) / 2, 1.2, (z + z2) / 2); o.rotation.set(0, -Math.atan2(z2 - z, x2 - x), 0); o.scale.set(Math.hypot(x2 - x, z2 - z) / 4, 1, 1); o.updateMatrix(); rails.setMatrixAt(i, o.matrix); o.scale.set(1, 1, 1);
    }
    posts.castShadow = rails.castShadow = true; target.add(posts, rails);
  }
  // rings for horseback (r 2.5, centre 3.2 m up) and four jumps on the north straight
  for (let i = 0; i < 8; i++) {
    const s = (i + .5) / 8, [x, z] = stadiumPoint(cx, cz, halfLen, radius, s), [x2, z2] = stadiumPoint(cx, cz, halfLen, radius, s + .002);
    add(new THREE.TorusGeometry(2.5, .22, 8, 32), M.cyan, x, 3.4, z, { ry: -Math.atan2(z2 - z, x2 - x) + Math.PI / 2 });
  }
  for (const j of [-30, -10, 10, 30]) box(.4, 1.1, width - 2, cx + j, 0, cz - radius, M.orange);
  sign('04 RIDING OVAL', '208×88 m · 479 m lap = 37 s at gallop', cx, 16, cz, 40);
}
function buildArena() {
  box(16, .4, 39, -160, 0, 111.5, M.light); for (const s of [-1, 1]) { box(4, 1, 4, -160 + s * 13, 6, 89, M.cyan); }   // approach + camera pads on the rim
  flatDisc(-160, 55, 28, 0.05, M.light);
  flatDisc(-160, 55, 33, 0.06, M.hazard, 29);
  ringWall(-160, 55, [[34, 0], [34, 6], [38, 6], [38, 0]], M.orange, [[-Math.PI / 2, .22]]);
  for (const [x, z] of [[-20, -10], [16, 14], [-8, 18]]) flatDisc(-160 + x, 55 + z, 4, 0.07, M.hazard);
  box(6, 6, 6, -160, 0, 55, M.orangeDark); box(5, 5, 5, -160, 6, 55, M.orange); box(3.5, 3.5, 3.5, -160, 11, 55, M.orangeDark);
  box(3, 3, 3, -165, 6, 55, M.orange); box(3, 3, 3, -155, 6, 55, M.orange);
  sign('CRATE TITAN · L20', 'r 28 floor (Driftwood r 22 + 6)', -160, 24, 55, 36);
  sign('BOSS APPROACH', '39×16 m · intro camera dolly', -160, 6, 112, 18);
}

function buildHover() {
  flatRect(-235, -95, -108, -18, 0.04, M.light);
  const pts = [[-9, 0], [9, 0], [9, 4.5], [8, 4.5]]; for (let i = 0; i <= 8; i++) { const a = -i / 8 * Math.PI / 2; pts.push([4 + 4 * Math.cos(a), 4.5 + 4 * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - i / 8 * Math.PI / 2; pts.push([-4 + 4 * Math.cos(a), 4.5 + 4 * Math.sin(a)]); } pts.push([-9, 4.5]);
  const hp = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), { depth: 45, bevelEnabled: false });
  hp.translate(0, 0, -22.5); add(hp, M.orange, -200, 0, -88, { ry: Math.PI / 2, edges: true });                 // halfpipe 45 m
  for (const [zz, h] of [[-62, 1.6], [-50, 2.4], [-38, 3.2]]) { wedge(7, h, 5, -112, zz, 0, M.orange); flatRect(-160, -116, zz - 1, zz + 1, .06, M.cyan); }  // kickers + 45 m run-up
  wedge(3, 1.6, 3, -135, -92, 0, M.dark); box(14, .4, 2.6, -135, 1.5, -92, M.orange, { rz: .2 });           // see-saw
  for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) box(2, 2, 2, -150 + i * 2.1 + r * 1.05, r * 2, -30, M.orangeDark);   // crate pile
  for (const [x, zz] of [[-210, -45], [-190, -45], [-170, -45]]) box(4, .25, 4, x, 0, zz, M.cyan);            // pressure plates
  box(1, 4, 20, -150, 0, -45, M.orangeDark);                                                                   // the gate they open
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) box(2, 2, 2, -225 + i * 2.1 + r * 1.05, r * 2, -30, M.orangeDark);
  sign('11 PHYSICS + HOVER', '140×90 m · halfpipe, kickers, plates', -165, 16, -63, 34);
}


// ---------- round 3 builders ----------
const P = placeContent();
const fmt = n => Math.round(n).toLocaleString('en-US');
const cobble = mat(0xd3cbb9), street = mat(0xa79f8f), wallC = mat(0xcf8a52);
function zoneDims(zn) {
  if (zn.shape === 'rect') return `${zn.x1 - zn.x0}×${zn.z1 - zn.z0} m`;
  if (zn.shape === 'disc') return `⌀${2 * zn.r} m`;
  if (zn.shape === 'stadium') return `${2 * (zn.halfLen + zn.r)}×${2 * zn.r} m`;
  return zn.list.map(([x0, x1, z0, z1]) => `${x1 - x0}×${z1 - z0}`).join(' + ') + ' m';
}
function zoneCentre(zn) {
  if (zn.shape === 'rect') return [(zn.x0 + zn.x1) / 2, (zn.z0 + zn.z1) / 2];
  if (zn.shape === 'rects') { const [x0, x1, z0, z1] = zn.list[0]; return [(x0 + x1) / 2, (z0 + z1) / 2]; }
  return [zn.x, zn.z];
}
function bang(x, y, z, yellow) {   // a quest "!" over a giver: yellow when a level-1 player may take it, grey when locked
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  g.font = 'bold 86px Helvetica'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = '#222'; g.strokeText('!', 32, 82);
  g.fillStyle = yellow ? '#ffd23a' : '#9a9a9a'; g.fillText('!', 32, 82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); s.scale.set(1, 1.5, 1); s.position.set(x, y, z); target.add(s);
}
function gable(w, d, x, y, z, m) {   // a pitched roof along the building's long side
  const along = w >= d, s = along ? d : w, L = along ? w : d, rh = Math.min(4.5, s * .38);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-s / 2 - .4, 0), new THREE.Vector2(s / 2 + .4, 0), new THREE.Vector2(0, rh)]), { depth: L + .6, bevelEnabled: false });
  g.translate(0, 0, -(L + .6) / 2); add(g, m, x, y, z, { ry: along ? Math.PI / 2 : 0, edges: true });
}

// R3: THE TOWN. Streets and lanes are open; every block fills with lots along its street faces (two rows back to back,
// lots 9-15 m wide, 2-4 storeys); the shops, the zip house and the stable are reserved first.
let tSeed = 31; const trnd = () => (tSeed = (tSeed * 16807) % 2147483647) / 2147483647;
function townPlan() {
  tSeed = 31;
  const out = [], R = (x0, x1, z0, z1, h, kind, label = '', sub = '') => out.push({ x0, x1, z0, z1, h, kind, label, sub });
  for (const s of HUB.services.filter(q => q.shop)) R(-80, -64, s.z < 0 ? -24 : 6, s.z < 0 ? -6 : 24, 9, 'shop', s.name, s.sub);
  for (const t of HUB.toLet) R(t.x - 8, t.x + 8, t.z < 0 ? -22 : 6, t.z < 0 ? -6 : 22, 7, 'tolet', 'TO LET', 'room for a future shop');
  const zh = HUB.zipHouse; R(zh.x0, zh.x1, zh.z0, zh.z1, zh.h, 'zip', 'ZIP HOUSE', 'the zipline lands on its roof');
  R(-32, -12, -84, -60, 7, 'stable', 'STABLE', 'stalls · loaner horses');
  R(-16, -9, -18, -7, 11, 'gatehouse'); R(-16, -9, 7, 18, 11, 'gatehouse');
  const reserved = out.slice(), hit = (a, b, m = 1) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
  const XS = [[-183, -146], [-134, -103], [-98, -64]], XN = [[-64, -46], [-34, -9]];
  const blocks = [];
  for (const [x0, x1] of XS) for (const [z0, z1] of [[-87, -52], [-47, -6], [6, 47], [52, 87]]) blocks.push([x0, x1, z0, z1]);
  for (const [x0, x1] of XN) for (const [z0, z1] of [[-87, -52], [-47, -24], [24, 47], [52, 87]]) blocks.push([x0, x1, z0, z1]);
  for (const [x0, x1, z0, z1] of blocks) {
    const wide = x1 - x0 >= z1 - z0, depth = wide ? z1 - z0 : x1 - x0, len = wide ? x1 - x0 : z1 - z0;
    const rows = depth >= 24 ? [[0, depth / 2], [depth / 2, depth]] : [[0, depth]];
    for (const [r0, r1] of rows) {
      let u = 0;
      while (u < len - 6) {
        const w = Math.min(len - u, 9 + Math.floor(trnd() * 7)), d = (r1 - r0) - (trnd() < .4 ? Math.floor(trnd() * 4) : 0);
        const front = r0 === 0 ? r0 : r1 - d;   // keep the frontage on the street side
        const b = wide ? { x0: x0 + u, x1: x0 + u + w, z0: z0 + front, z1: z0 + front + d } : { x0: x0 + front, x1: x0 + front + d, z0: z0 + u, z1: z0 + u + w };
        u += w + (trnd() < .16 ? 4 : 0);
        if (len - u < 7 && len - u > 0) { if (wide) b.x1 = x1; else b.z1 = z1; u = len; }
        if (reserved.some(q => hit(b, q))) continue;
        const h = [6, 7.5, 9, 9, 10.5, 12][Math.floor(trnd() * 6)];
        out.push({ ...b, h, kind: 'house', roof: trnd() < .6 });
      }
    }
  }
  return out;
}
const TOWN_B = townPlan();
function buildTown() {
  flatRect(TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1, 0.035, cobble);
  // streets: Main Street (shop row), the lanes to the gates, two back alleys, the gate plaza
  flatRect(TOWN.x0, PLAZA.x0, -6, 6, 0.045, street); flatRect(-46, -34, TOWN.z0, TOWN.z1, 0.045, street); flatRect(-146, -134, TOWN.z0, TOWN.z1, 0.045, street);
  for (const s of [-1, 1]) flatRect(TOWN.x0, TOWN.x1, s > 0 ? 47 : -52, s > 0 ? 52 : -47, 0.045, street);
  flatRect(-103, -98, TOWN.z0, TOWN.z1, 0.045, street);
  flatRect(PLAZA.x0, TOWN.x1, PLAZA.z0, PLAZA.z1, 0.05, M.light);
  // the town wall (5 m, walk on top) with its six gates
  const gapAt = (side, v) => GATES.filter(g => (side === 'N' && g.z === TOWN.z0) || (side === 'S' && g.z === TOWN.z1) || (side === 'W' && g.x === TOWN.x0) || (side === 'E' && g.x === TOWN.x1)).map(g => side === 'N' || side === 'S' ? g.x : g.z);
  const run = (a, b, gaps, f) => { let s = a; for (const g of [...gaps].sort((p, q) => p - q)) { if (g - 6 > s) f(s, g - 6); s = g + 6; } if (b > s) f(s, b); };
  for (const [side, zc] of [['N', TOWN.z0], ['S', TOWN.z1]]) run(TOWN.x0, TOWN.x1, gapAt(side), (a, b) => box(b - a, TOWN.wall, 1.2, (a + b) / 2, 0, zc, wallC));
  for (const [side, xc] of [['W', TOWN.x0], ['E', TOWN.x1]]) run(TOWN.z0, TOWN.z1, gapAt(side), (a, b) => box(1.2, TOWN.wall, b - a, xc, 0, (a + b) / 2, wallC));
  for (const g of GATES) {
    const ns = g.z === TOWN.z0 || g.z === TOWN.z1;
    for (const s of [-1, 1]) box(2.2, 9, 2.2, g.x + (ns ? s * 6.5 : 0), 0, g.z + (ns ? 0 : s * 6.5), M.orangeDark);
    box(ns ? 15 : 2.2, 1.2, ns ? 2.2 : 15, g.x, 7.8, g.z, M.orangeDark);
    sign(g.name, g.to, g.x, 12, g.z, g.id === 'E' ? 24 : 18);
  }
  // buildings
  const walls = [M.light, M.white, M.grey, cobble];
  TOWN_B.forEach((b, i) => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (b.kind === 'house') { box(w - .3, b.h, d - .3, cx, 0, cz, walls[i % 4]); if (b.roof) gable(w - .3, d - .3, cx, b.h, cz, i % 3 ? M.orange : M.orangeDark); else box(w, .5, d, cx, b.h, cz, M.orangeDark); return; }
    if (b.kind === 'gatehouse') { box(w, b.h, d, cx, 0, cz, wallC); box(w + .6, .6, d + .6, cx, b.h, cz, M.orangeDark); return; }
    const m = b.kind === 'shop' ? M.orange : b.kind === 'tolet' ? M.grey : b.kind === 'zip' ? M.light : M.dirt;
    box(w, b.h, d, cx, 0, cz, m); box(w + .6, .6, d + .6, cx, b.h, cz, b.kind === 'zip' ? M.cyan : M.orangeDark);
    if (b.kind === 'shop' || b.kind === 'tolet') {   // awning on the street face
      const fz = cz < 0 ? b.z1 : b.z0, fx = b.x1;
      box(w - 1, .25, 3, cx, 3.2, fz + (cz < 0 ? 1.5 : -1.5), b.kind === 'shop' ? M.cyan : M.light);
      if (b.kind === 'shop') box(.25, .25, d - 2, fx + 1.5, 3.2, cz, M.cyan);
    }
    if (b.kind === 'stable') for (let k = 0; k < 4; k++) box(.4, 2.4, 6, b.x0 + 3 + k * 5, 0, b.z1 + 3, M.dark);
    if (b.kind === 'shop') sign(b.label, b.sub, cx + 2, 6.4, cz < 0 ? b.z1 + 3 : b.z0 - 3, 16);   // over the awning on Main Street                       // over the door on the plaza face
    else if (b.kind === 'tolet') sign(b.label, b.sub, cx, 5.4, cz < 0 ? b.z1 + .4 : b.z0 - .4, 12);   // on the street face
    else sign(b.label, b.sub, cx, b.h + 2.6, cz, 12);
  });
  // the gate plaza: quest corner (board + three givers), contracts, trophy wall, feats; the obelisk is the landmark
  for (const s of HUB.services.filter(q => !q.shop)) {
    if (s.id === 'TW') {
      box(10, 4, .6, s.x, 0, s.z, M.orange);
      for (let i = 0; i < 12; i++) box(1.1, 1.1, .15, s.x - 3.75 + (i % 6) * 1.5, i < 6 ? 2.35 : .95, s.z - .4, i < 9 ? M.white : M.grey, { shadow: false });
    } else box(s.id === 'FT' ? 4 : 6, 3.2, .5, s.x, 0, s.z, s.id === 'QB' ? M.orange : M.orangeDark, { ry: s.ry });
    sign(s.name, '', s.x, s.id === 'TW' ? 6 : 5.4, s.z, 8);
  }
  for (const n of HUB.npcs) {
    capsule(n.x, n.z, 1.8, .4, n.giver ? M.grey : M.cyan);
    if (n.giver) bang(n.x, 3.1, n.z, n.lock === 'L1–6');
    sign(n.name.toUpperCase(), n.lock, n.x, n.giver ? 4.4 : 3.2, n.z, 8);
  }
  // market stalls and lamp posts so the plaza reads as a square, not a car park
  for (const [x, z] of [[-54, 6], [-46, 8], [-38, 6], [-30, 8]]) { box(3.2, 1, 2, x, 0, z, M.dirt); for (const dx of [-1.5, 1.5]) box(.15, 2.6, .15, x + dx, 0, z - .9, M.dark, { edges: false }); box(3.8, .2, 2.6, x, 2.6, z, [M.orange, M.cyan, M.white, M.orange][Math.abs(x) % 4]); }
  for (const [x, z] of [[-62, -22], [-18, -22], [-62, 22], [-18, 22], [-40, -2]]) { box(.25, 4.5, .25, x, 0, z, M.dark, { edges: false }); box(.7, .5, .7, x, 4.5, z, M.glow, { edges: false }); }
  const ob = HUB.obelisk;
  box(5, 1.5, 5, ob.x, 0, ob.z, M.grey); add(new THREE.CylinderGeometry(.5, 1.4, ob.h - 1.5, 4), M.orange, ob.x, 1.5 + (ob.h - 1.5) / 2, ob.z, { ry: Math.PI / 4, edges: true });
  add(new THREE.OctahedronGeometry(1.1), M.cyan, ob.x, ob.h + .6, ob.z);
  sign('OBELISK', 'the town landmark · 22 m', ob.x, ob.h + 4, ob.z, 14);
  sign('01 TOWN', '176×176 m · gate plaza · shop row · six gates', -100, 30, 0, 34);
  sign('GATE PLAZA', '48×48 m · quests · contracts · trophies', -40, 9, 0, 22);
  sign('MAIN STREET · SHOP ROW', '', -110, 7, 0, 22);
}
function buildPaddock() {
  const zn = ZONES.find(z => z.id === 'MP');
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.dirt);
  for (const [a, b, c, d] of [[zn.x0, zn.x1, zn.z0, zn.z0], [zn.x0, zn.x0, zn.z0, zn.z1], [zn.x1, zn.x1, zn.z0, zn.z1], [zn.x0, -46, zn.z1, zn.z1], [-34, zn.x1, zn.z1, zn.z1]])
    box(Math.max(.25, b - a), 1.3, Math.max(.25, d - c), (a + b) / 2, 0, (c + d) / 2, M.white, { edges: false });
  for (const s of [-1, 1]) box(.3, 1.4, 8, -40 + s * 6, 0, zn.z0 - 4, M.white, { edges: false });   // the chute onto the oval
  const hx = -30, hz = -112;   // the loaner horse
  box(2.4, 1.1, .9, hx, 1.1, hz, M.dirt); box(.8, 1.2, .6, hx + 1.4, 1.8, hz, M.dirt); for (const [dx, dz] of [[-.9, -.3], [-.9, .3], [.9, -.3], [.9, .3]]) box(.2, 1.1, .2, hx + dx, 0, hz + dz, M.dark, { edges: false });
  box(2, .8, 2, -36, 0, -104, M.grey);   // mounting block
  capsule(HUB.stableHand.x, HUB.stableHand.z, 1.8, .4, M.cyan);
  sign('STABLE HAND', 'loaner horse', HUB.stableHand.x, 3.2, HUB.stableHand.z, 8);
  sign('PADDOCK', 'the riding course entrance', -40, 8, -118, 18);
}
function buildMovers() {   // R3: stacked: a 1.3-turn spiral of 12 platforms, 1.5 -> 18 m, on 48 x 44 m
  const zn = ZONES.find(z => z.id === '05'), cx = (zn.x0 + zn.x1) / 2, cz = (zn.z0 + zn.z1) / 2;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.light);
  for (let i = 0; i < 12; i++) {
    const a = -.38 - (11 - i) * .75, r = 15 - (i % 2) * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = 1.5 * (i + 1);
    box(6, 1, 6, x, y - 1, z, i % 3 === 1 ? M.cyan : M.orange); box(.6, y - 1, .6, x, 0, z, M.dark);
  }
  box(4, 18, 4, cx, 0, cz, M.grey);   // the core the spiral climbs round
  sign('05 MOVERS PARK', 'stacked spiral 0 → 18 m', cx, 26, cz, 26);
}
function buildHopChain() {   // tank -> mast -> tower, each hop <= 38 m; the zip runs into town
  const T = ZONES.find(z => z.id === 'C'), tw = ZONES.find(z => z.id === '06'), tx = (tw.x0 + tw.x1) / 2, tz = (tw.z0 + tw.z1) / 2;
  cyl(16, 16, 18, T.x, 0, T.z, M.tank, { seg: 32 }); cyl(16.3, 16.3, 1.2, T.x, 16.8, T.z, M.orange, { seg: 32 });
  cable(sag([-193, 18, -120], [T.x - 16, 18.2, T.z - 2], 1.6), 0x6b4a2a, .25);   // rope bridge from the movers' top step
  sign('WATER TANK', '18 m · roof vista · hook 1', T.x, 26, T.z, 22);
  box(1.4, 28, 1.4, -180, 0, -80, M.dark); add(new THREE.SphereGeometry(1.4, 12, 8), M.cyan, -180, 28.6, -80);
  sign('HOOK MAST', '28 m', -180, 33, -80, 12);
  for (const [dx, dz] of [[-7, -7], [7, -7], [7, 7], [-7, 7]]) box(1.2, 45, 1.2, tx + dx, 0, tz + dz, M.orange);
  for (let y = 9; y < 45; y += 9) box(16, .6, 16, tx, y, tz, M.orangeDark);
  box(5, 3, 5, tx, 45, tz, M.cyan);
  const zh = HUB.zipHouse; cable(sag([tx, 45, tz], [(zh.x0 + zh.x1) / 2, zh.h + 2, (zh.z0 + zh.z1) / 2], 6, 20));
  sign('06 GRAPPLE TOWER', '45 m lattice · zip 98 m into town', tx, 54, tz, 30);
}
function buildRock() {   // R3: Cave Hill reshaped into the town's crag (the lookout is its top bench)
  const zn = ZONES.find(z => z.id === 'H'), cx = (zn.x0 + zn.x1) / 2, cz = (zn.z0 + zn.z1) / 2;
  const m = add(new THREE.CylinderGeometry(9, 23, 16, 6), M.grey, cx, 8, cz, { edges: true }); m.scale.set(1, 1, 1.28);
  box(2.4, .5, .7, LOOKOUT.x, 16, LOOKOUT.z, M.white);
  for (let i = 0; i < 7; i++) box(4, 2.2 * (i + 1) * .33, 3, cx - 9 + i * 3, 0, zn.z1 - 2 - (i % 2), M.grey);   // scramble steps from the park
  box(.5, 16, .7, TOWN.x0 - 2, 0, 76, M.dark);                                                                // ladder up from the town wall walk
  box(5, 3.5, 1, cx + 4, 0, zn.z1 + .2, M.dark, { edges: false });                                          // squeeze cave mouth (park side)
  box(1, 2.6, 3, TOWN.x0 + 4, 0, 66, M.dark, { edges: false });                                             // cellar door (town side)
  sign('THE ROCK', '16 m crag · lookout · squeeze cave', cx, 24, cz, 26);
  sign('LOOKOUT', 'tank, mast and tower in one frame', LOOKOUT.x, 19.5, LOOKOUT.z, 14);
}
function buildStealth() {   // R3: the yard is band 5; beacon towers on its corners
  const y = ZONES.find(z => z.id === '07');
  flatRect(y.x0, y.x1, y.z0, y.z1, 0.04, M.light);
  const wall = (x0, z0, x1, z1) => box(Math.max(.6, Math.abs(x1 - x0)), 2.6, Math.max(.6, Math.abs(z1 - z0)), (x0 + x1) / 2, 0, (z0 + z1) / 2, M.orange);
  const [n0, n1] = [140, 156], [w0, w1] = [58, 74];
  wall(y.x0, y.z0, n0, y.z0); wall(n1, y.z0, y.x1, y.z0); wall(y.x1, y.z0, y.x1, y.z1); wall(y.x0, y.z1, y.x1, y.z1);
  wall(y.x0, y.z0, y.x0, w0); wall(y.x0, w1, y.x0, y.z1);
  box(8, 4, 6, 220, 0, 106, M.orangeDark); sign('KEYCARD', 'shed', 220, 8, 106, 10);
  sign('07 STEALTH YARD = BAND 5', 'Riveter patrols · L13–15 · storm cover', 179, 15, 66, 36);
}
function buildGauntlet() {
  const g = ZONES.find(z => z.id === '08');
  flatDisc(g.x, g.z, 28, 0.05, M.dirt);
  ringWall(g.x, g.z, [[28, 0], [28, 1.2], [32, 1.2], [32, 2.4], [36, 2.4], [36, 3.6], [42, 3.6], [42, 0]], M.orange, [[Math.PI / 2, .3], [0, .3]]);
  capsule(g.x, g.z, 3.4, .9, M.elite);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; enemy(k % 2 ? 'Riveter' : 'Arc Sentry', g.x + Math.cos(a) * 16, g.z + Math.sin(a) * 16, false); }
  sign('08 GAUNTLET · L16–18', 'waves · finale FOREMAN UNIT 7 · L18', g.x, 18, g.z, 34);
}
function buildVault() {
  const v = ZONES.find(z => z.id === 'TV'), cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
  box(16, 9, 18, cx + 2, 0, cz, M.grey); box(17, .6, 19, cx + 2, 9, cz, M.orangeDark);
  add(new THREE.TorusGeometry(3.6, .5, 10, 40), M.portal, cx - 6.3, 4.2, cz, { ry: Math.PI / 2 });
  add(new THREE.CircleGeometry(3.4, 32), M.portal, cx - 6.2, 4.2, cz, { ry: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) box(2, .3 * (i + 1), 12, cx - 9 - i * 2, 0, cz, M.grey);
  box(.4, 2.6, 5, cx - 8, 0, cz - 8, M.white); sign('4 ROOMS · ELITE · ~10 MIN', 'puzzle · fight · climb · Vault Warden L12', cx - 8, 4, cz - 8, 20);
  sign('TRAINING VAULT', 'the mini dungeon · rooms at y −40', cx, 14, cz, 24);
}

// enemies: one silhouette per type so the bands read apart at eye height
function enemy(kind, x, z, night) {
  const b = night ? M.night : M.hazard, e = M.glow;
  if (kind === 'Crate Mite') { box(.9, .8, .9, x, .45, z, b); for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [.4, .4], [-.4, .4]]) box(.12, .5, .12, x + dx, 0, z + dz, M.dark, { edges: false }); if (night) add(new THREE.SphereGeometry(.12, 6, 4), e, x, .95, z + .46); return; }
  if (kind === 'Pallet Jack') { box(1.4, 1.3, 1.8, x, 0, z, b); box(.18, .12, 1.4, x - .4, .2, z + 1.5, M.dark); box(.18, .12, 1.4, x + .4, .2, z + 1.5, M.dark); if (night) add(new THREE.SphereGeometry(.14, 6, 4), e, x, 1.1, z + .92); return; }
  if (kind === 'Plumb Drone') { add(new THREE.SphereGeometry(.55, 12, 8), b, x, 3, z); add(new THREE.TorusGeometry(.85, .08, 6, 20), M.dark, x, 3, z, { rx: Math.PI / 2 }); if (night) add(new THREE.SphereGeometry(.15, 6, 4), e, x, 3, z + .55); return; }
  if (kind === 'Welder Unit') { capsule(x, z, 2, .45, b); add(new THREE.ConeGeometry(.9, 2.6, 12), M.flame, x, 1.2, z + 1.8, { rx: -Math.PI / 2, shadow: false }); if (night) add(new THREE.SphereGeometry(.13, 6, 4), e, x, 1.75, z + .42); return; }
  if (kind === 'Riveter') { capsule(x, z, 2.2, .5, b); box(1.6, 2, .2, x, .1, z + .8, M.grey); if (night) add(new THREE.SphereGeometry(.13, 6, 4), e, x, 2.25, z + .5); return; }
  capsule(x, z, 2.5, .35, b); box(.1, .1, 2.6, x + .4, 1.4, z + 1, M.cyan); if (night) add(new THREE.SphereGeometry(.12, 6, 4), e, x, 2.2, z + .33);
}
function coverPiece(c) {
  const g = new THREE.Group(); target = g;
  if (c.kind === 'crates') { const n = 2 + Math.floor(c.h * 3); for (let i = 0; i < n; i++) box(1.6, 1.6, 1.6, (i % 3) * 1.7 - 1.7, i >= 3 ? 1.6 : 0, i >= 3 ? 0 : (i % 2) * .4, i % 2 ? M.orangeDark : M.orange); if (n > 2) box(1.6, 1.6, 1.6, 0, 1.6, 0, M.orange); }
  if (c.kind === 'walls') { box(8, 3, .6, 0, 0, 0, M.grey); box(2.4, 1.1, 2.4, 5.5, 0, 1.5, M.orangeDark); }
  if (c.kind === 'pillars') { box(1.6, 7, 1.6, -4, 0, 0, M.grey); box(1.6, 7, 1.6, 4, 0, 0, M.grey); box(9.6, .6, .8, 0, 6.4, 0, M.orangeDark); box(7.6, 4, .2, 0, 2.2, 0, M.dark, { edges: false }); }
  if (c.kind === 'bays') { box(6, 3, .5, 0, 0, -2, M.grey); box(.5, 3, 4, -3, 0, 0, M.grey); box(.5, 3, 4, 3, 0, 0, M.grey); flatDisc(0, 1.2, 1.4, .06, M.hazard); }
  if (c.kind === 'tall') { box(2, 3.2, 10, 0, 0, 0, M.grey); }
  if (c.kind === 'half') { box(5, 1.1, .8, 0, 0, 0, M.orange); box(.8, 1.1, 3, 2.9, 0, 1.1, M.orange); }
  if (c.kind === 'sightwall') { box(12, 3, .6, 0, 0, 0, M.orangeDark); }
  g.position.set(c.x, 0, c.z); g.rotation.y = c.ry; world.add(g); target = world;
}

const packSigns = [];
const BAND_TINT = [0xe9e2b0, 0xe6cf98, 0xe0b483, 0xd8956f, 0xcd765f, 0xbf5852];
function arch(x, z, ry, text, sub) {
  place(() => { for (const s of [-1, 1]) box(1.6, 7, 1.6, s * 7, 0, 0, M.orangeDark); box(16, 1.2, 1.6, 0, 7, 0, M.orangeDark); }, x, z, ry);
  sign(text, sub, x, 10.5, z, 18);
}
function buildEast() {
  for (const zn of ZONES.filter(q => q.kind === 'band')) {
    flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.02, mat(BAND_TINT[zn.band - 1]));
    const B = BANDS.find(b => b.band === zn.band), [cx, cz] = zoneCentre(zn);
    if (zn.band !== 5) sign(zn.name, `${B.enemy} · ${B.role}`, cx, 14, cz, 30);
  }
  for (const p of P.packs) {
    cyl(1.4, 2, 1.2, p.x, 0, p.z, mat(0x34383c), { seg: 6 });
    packSigns.push(sign(`${p.night ? 'NIGHT SHIFT ' : ''}${p.enemy.toUpperCase()}`, `L${p.lv}${p.night ? ` · L${p.lv + 1} after dark` : ''}`, p.x, 4.6, p.z, 9));
    for (let k = 0; k < p.size; k++) enemy(p.enemy, p.x + Math.cos(k * 2.4 + 1) * 3.2, p.z + Math.sin(k * 2.4 + 1) * 3.2, p.night);
    if (p.inYard) { const g = new THREE.CircleGeometry(15, 24, -Math.PI / 6, Math.PI / 3); g.rotateX(-Math.PI / 2); add(g, M.cone, p.x, .15, p.z, { ry: (p.x + p.z) % 6, shadow: false }); }
  }
  for (const c of P.cover) coverPiece(c);
  for (const l of P.lairs) {
    flatDisc(l.x, l.z, ELITE_LAIR_R, .05, M.dirt);
    ringWall(l.x, l.z, [[ELITE_LAIR_R, 0], [ELITE_LAIR_R, 1.2], [ELITE_LAIR_R + 1.4, 1.2], [ELITE_LAIR_R + 1.4, 0]], M.dark, [[0, .7]]);
    capsule(l.x, l.z, 2.6, .7, M.elite); sign(l.name.toUpperCase(), `night elite L${l.lv}`, l.x, 6, l.z, 16);
  }
  for (const c of P.chests) box(1.4, 1, .9, c.x, 0, c.z, M.glow);
  for (const c of P.crates) { box(1, 1, 1, c.x, 0, c.z, M.orangeDark); box(1.02, .2, 1.02, c.x, .4, c.z, M.cyan, { edges: false }); }
  for (const b of BEACONS) { box(4, 12, 4, b.x, 0, b.z, M.grey); box(1.4, 6, 1.4, b.x, 12, b.z, M.dark); box(2.6, 2, 2.6, b.x, 18, b.z, M.glow); sign(`BEACON ${b.n}`, 'storm hour', b.x, 24, b.z, 12); }
  // seam wall with the seam gate (the only way in), the walled combat road with its band gates, the SE half wall
  for (const s of [-1, 1]) box(1, 3, STRIP.inner - ROAD.half, SEAM_X, 0, s * (ROAD.half + STRIP.inner) / 2, M.orange);
  for (const s of [-1, 1]) box(2, 8, 2, SEAM_X, 0, s * (ROAD.half + 1), M.orangeDark);
  sign('SEAM GATE', 'the combat half · enemies past this point', SEAM_X + 3, 11, 0, 26);
  for (const s of [-1, 1]) {
    const gaps = ROAD_GATES.filter(g => g[2] === s).map(g => [g[0], g[1]]).sort((a, b) => a[0] - b[0]);
    let x = ROAD.x0; for (const [a, b] of [...gaps, [STRIP.inner, STRIP.inner]]) { if (a > x) box(a - x, 3, 1, (a + x) / 2, 0, s * ROAD.half, M.orange); x = b; }
    for (const [a, b] of gaps) for (const xx of [a, b]) box(1.6, 5, 1.6, xx, 0, s * ROAD.half, M.orangeDark);
  }
  for (const [a, b, s] of ROAD_GATES) { const n = s < 0 ? ZONES.find(z => z.kind === 'band' && inZone(z, (a + b) / 2, -20)) : ZONES.find(z => z.kind === 'band' && inZone(z, (a + b) / 2, 20)); sign(n.name, '', (a + b) / 2, 7.5, s * (ROAD.half + 2), 14); }
  { let x = ROAD.x0; for (const [a, b] of [...SE_WALL.gates, [STRIP.inner, STRIP.inner]]) { if (a > x) box(a - x, 3, 1, (a + x) / 2, 0, SE_WALL.z, M.orange); x = b; } }
  sign('GAUNTLET GATE', '', 62, 7, SE_WALL.z, 14); sign('TO THE TITAN', 'approach + intro', 108, 7, SE_WALL.z, 14);
  for (const a of ARCHES) { const B = BANDS[a.band - 1]; arch(a.x, a.z, a.ry, `BAND ${a.band} · L${B.lv[0]}–${B.lv[2]}`, B.enemy); }
  const bp = GATE_ELITES[0];
  flatDisc(bp.x, bp.z, 12, 0.05, M.dirt); ringWall(bp.x, bp.z, [[12, 0], [12, 1.4], [14, 1.4], [14, 0]], M.orangeDark, [[Math.PI / 2, .5], [-Math.PI / 2, .5]]);
  capsule(bp.x, bp.z, 3.6, 1, M.elite); sign('BIG PALLET', 'band-gate elite · L6', bp.x, 9, bp.z, 16);
}
function buildSecrets() {
  for (const q of SECRETS) q.k === 'b' ? box(2, .5, .7, q.x, q.y, q.z + 2, M.white) : box(.9, .9, .9, q.x, q.y, q.z, M.cyan);
  for (const g of GOLD) box(1, 1, 1, g.x, g.y, g.z, M.gold);
  sign('PERIMETER STRIP', 'the safe ring road', -120, 6, 242, 26);
}
buildGround(); buildTown(); buildPaddock();
place(buildRange, -114, -18, Math.PI);
place(buildRiding, -252, -21);
buildMovers(); buildHopChain(); buildRock();
place(buildHover, 1, 248);
buildStealth(); buildGauntlet();
place(buildArena, 245, 352, -Math.PI / 2);
buildVault(); buildEast(); buildSecrets();

// ---------- plan overlays ----------
const planOnly = new THREE.Group(), budgetOnly = new THREE.Group(); scene.add(planOnly, budgetOnly);
function lineGrid(step, color, opacity, group, y = 60) {
  const pts = []; for (let v = -HALF; v <= HALF + .01; v += step) { pts.push(v, y, -HALF, v, y, HALF, -HALF, y, v, HALF, y, v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false })); l.renderOrder = 9; group.add(l);
}
lineGrid(50, 0x0b2a52, .55, planOnly);
{ // the vault's four rooms, dashed, under band 4
  const I = INTERIORS[0], m = new THREE.LineDashedMaterial({ color: 0x1238c8, dashSize: 3, gapSize: 2, depthTest: false });
  const sq = (x, z, w, d) => { const g = new THREE.BufferGeometry().setFromPoints([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2], [x - w / 2, z - d / 2]].map(([a, b]) => new THREE.Vector3(a, 61, b))); const l = new THREE.Line(g, m); l.computeLineDistances(); l.renderOrder = 11; planOnly.add(l); };
  sq(I.cx, I.cz, I.w, I.d);
  I.rooms.forEach(([, w, d], i) => sq(I.cx + (i % 2 ? 17 : -17), I.cz + (i < 2 ? -17 : 17), w, d));
}
const KIND = { town: 0x2f6fd0, west: 0xe2782c, cand: 0x1fa7b8, set: 0x7d1d2c, band: 0xc9604f };
for (const zn of ZONES) {
  const m = new THREE.MeshBasicMaterial({ color: zn.kind === 'band' ? BAND_TINT[zn.band - 1] : KIND[zn.kind], transparent: true, opacity: zn.kind === 'band' ? .92 : zn.kind === 'town' ? .55 : .85, depthTest: false });
  if (zn.kind === 'band') m.color.offsetHSL(0, .25, -.18);
  const put = g => { g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; return mesh; };
  if (zn.shape === 'rect') { const mesh = put(new THREE.PlaneGeometry(zn.x1 - zn.x0, zn.z1 - zn.z0)); mesh.position.set((zn.x0 + zn.x1) / 2, zn.kind === 'band' ? 58.5 : 59, (zn.z0 + zn.z1) / 2); if (zn.kind === 'band' || zn.kind === 'town') mesh.renderOrder = 5.5; budgetOnly.add(mesh); }
  if (zn.shape === 'disc') { const mesh = put(new THREE.CircleGeometry(zn.r, 64)); mesh.position.set(zn.x, 59, zn.z); budgetOnly.add(mesh); }
  if (zn.shape === 'stadium') { const g = new THREE.ShapeGeometry(stadiumShape(zn.x, zn.z, zn.halfLen, zn.r), 8); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.y = 59; mesh.renderOrder = 6; budgetOnly.add(mesh); }
}
{
  const cm = new THREE.MeshBasicMaterial({ color: 0x3c4148, transparent: true, opacity: .75, depthTest: false });
  const rect = (x0, x1, z0, z1, m, y = 58) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); mesh.renderOrder = 5; budgetOnly.add(mesh); };
  rect(-250, 250, -250, -STRIP.inner, cm); rect(-250, 250, STRIP.inner, 250, cm); rect(-250, -STRIP.inner, -STRIP.inner, STRIP.inner, cm); rect(STRIP.inner, 250, -STRIP.inner, STRIP.inner, cm);
  rect(TOWN.x1, ROAD.x0, -STRIP.inner, STRIP.inner, cm); rect(-STRIP.inner, TOWN.x0, -AVENUE_HALF, AVENUE_HALF, cm); rect(ROAD.x0, STRIP.inner, -ROAD.half, ROAD.half, cm);
  const band = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: .22, depthTest: false });
  const e = HALF - REAL.edgeBand; rect(-250, 250, -250, -e, band, 61); rect(-250, 250, e, 250, band, 61); rect(-250, -e, -e, e, band, 61); rect(e, 250, -e, e, band, 61);
  lineGrid(REAL.l0Tile, 0xffffff, .45, budgetOnly, 62);
}
const placeOnly = new THREE.Group(); scene.add(placeOnly);
for (const p of P.packs) {   // placement map: each pack's aware circle so spacing is visible
  const B = BANDS.find(b => b.band === p.band), g = new THREE.RingGeometry(B.aware - .6, B.aware, 40); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: p.night ? 0x1a2a7a : 0x8a1020, transparent: true, opacity: .8, depthTest: false })); m.position.set(p.x, 62, p.z); m.renderOrder = 12; placeOnly.add(m);
}


// ---------- cameras, labels, views ----------
const ortho = new THREE.OrthographicCamera(-262, 262, 262, -262, 1, 2000);
const persp = new THREE.PerspectiveCamera(62, 1, .3, 3000);
const controls = new OrbitControls(persp, renderer.domElement); controls.enabled = false;
const $ = id => document.getElementById(id);
const VW = () => document.documentElement.clientWidth, VH = () => document.documentElement.clientHeight;
let frame = { x0: -262, x1: 262, z0: -262, z1: 262 };
function setFrame(x0, x1, z0, z1) { frame = { x0, x1, z0, z1 }; Object.assign(ortho, { left: x0, right: x1, top: -z0, bottom: -z1 }); ortho.position.set(0, 800, 0); ortho.up.set(0, 0, -1); ortho.lookAt(0, 0, 0); ortho.updateProjectionMatrix(); }
function project(x, z, size) { return [(x - frame.x0) / (frame.x1 - frame.x0) * size, (z - frame.z0) / (frame.z1 - frame.z0) * size]; }
function mark(L, x, z, size, text, color, fs = 9, cls = 'tick') { const [px, pz] = project(x, z, size); if (px < 0 || pz < 0 || px > size || pz > size) return; const d = document.createElement('div'); d.className = cls; d.style.color = color; d.style.fontSize = fs + 'px'; d.style.fontWeight = '700'; d.style.textShadow = '0 0 2px #000, 0 0 2px #000'; d.innerHTML = text; d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d); }
const OFF = { '01': [0, -50], 'C': [0, -24], '05': [0, 0], '06': [0, -20], 'K': [0, -22], '09': [0, 10], '08': [0, 0], '11': [0, 0], 'B1': [0, 0], 'B6': [0, -6], 'B4': [-30, 0], 'B5': [0, -38], 'B2': [-22, 34], 'M6': [0, 18], 'TV': [-10, 18], 'MP': [0, 0], 'H': [0, 0], '07': [0, 30], '04': [0, 0], '02': [0, 0], 'B3': [0, 0] };
function planLabels(size, top, mode) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  if (mode !== 'place') for (const zn of ZONES) {
    const [cx, cz] = zoneCentre(zn), [ox, oz] = OFF[zn.id] ?? [0, 0];
    const [px, pz] = project(cx + ox, cz + oz, size);
    const d = document.createElement('div'); d.className = 'lb ' + (zn.kind === 'cand' ? 'cand' : '');
    d.innerHTML = zn.kind === 'band' ? `${zn.name}<i>${fmt(zoneArea(zn))} m²</i>` : zn.id === 'M6' ? zn.name : `${/^[0-9]/.test(zn.id) ? zn.id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>`;
    if (zn.id === '01') { d.style.fontSize = '10px'; d.style.background = '#ffffffcc'; d.style.padding = '1px 3px'; }
    d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d);
  }
  if (mode !== 'place') for (let v = -250; v <= 250; v += 50) { mark(L, v, -256, size, v, '#e9e9e9', 6.5); mark(L, -255, v, size, v, '#e9e9e9', 6.5); }
  if (mode === 'budget') return;
  for (const q of SECRETS) mark(L, q.x, q.z, size, q.k === 'b' ? '★' : '◆', q.k === 'b' ? '#fff' : '#1fd3e8');
  for (const b of BEACONS) mark(L, b.x, b.z, size, `✦${b.n}`, '#ffd23a', mode === 'place' ? 13 : 10);
  for (const q of P.quests) mark(L, q.x, q.z, size, mode === 'place' ? `!<span style="font-size:8px">L${q.lock}</span>` : '!', '#ffe14a', mode === 'place' ? 13 : 11);
  if (mode === 'place') {
    for (const p of P.packs) mark(L, p.x, p.z - 9, size, (p.night ? '☾' : '') + 'Mk' + 'I'.repeat(p.tier + 1), p.night ? '#9fb4ff' : '#ffffff', 8);
    for (const l of P.lairs) mark(L, l.x, l.z, size, `◆ ${l.name}<br><span style="font-size:7px">night elite L${l.lv}</span>`, '#e09bff', 9);
    for (const e of GATE_ELITES) mark(L, e.x, e.z, size, `◆ ${e.name}<br><span style="font-size:7px">${e.lv === 20 ? 'boss' : 'band-gate elite'} L${e.lv}</span>`, '#e09bff', 9);
    for (const c of P.chests) mark(L, c.x, c.z, size, '■', '#ffc35a', 10);
    for (const c of P.crates) mark(L, c.x, c.z, size, '▪', '#3fe0ee', 9);
    for (const g of GOLD) mark(L, g.x, g.z, size, '●', '#ffd000', 10);
    for (const b of BANDS) { const zn = ZONES.find(z => z.band === b.band), [cx, cz] = zoneCentre(zn); mark(L, cx, cz + (b.band === 5 ? -44 : b.band === 6 ? -44 : 0), size, `B${b.band} · ${b.enemy} L${b.lv[0]}–${b.lv[2]} · ${b.packsPerTier * 3} packs`, '#ffffff', 10); }
    for (const [a, b, s] of ROAD_GATES) mark(L, (a + b) / 2, s * 13, size, 'gate', '#ffd9b0', 8);
  } else {
    for (const g of GOLD) mark(L, g.x, g.z, size, '●', '#ffd000', 8);
    for (const g of GATES) mark(L, g.x, g.z, size, '⛩', '#ffd9b0', 9);
  }
}
function layoutCanvas(w, h, top) { renderer.setSize(w, h); renderer.domElement.style.top = top + 'px'; }
let current = null;
function render(cam) { if (cam === persp) persp.updateProjectionMatrix(); renderer.render(scene, cam); }
const B_ = budget(), G_ = grind(P), S_ = onScreen(P), R2_ = coverReach(P), R1_ = coverReach(P, false);
const sw = c => `<span class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></span>`;
const SVC = [...HUB.services, ...HUB.npcs];
const townSpan = (() => { let m = 0; for (const a of SVC) for (const b of SVC) m = Math.max(m, Math.hypot(a.x - b.x, a.z - b.z)); return m; })();
const houses = TOWN_B.filter(b => b.kind === 'house').length;
function townSvg() {   // the town inset: every building, the plaza, the services and the gates
  const k = 128 / 180, P2 = (x, z) => [(x - TOWN.x0 + 2) * k, (z - TOWN.z0 + 2) * k];
  const el = [`<svg width="130" height="140" viewBox="0 0 130 140"><rect x="0" y="0" width="130" height="130" fill="#c9c0ad"/>`];
  const r = (x0, x1, z0, z1, f) => { const [a, b] = P2(x0, z0), [c, d] = P2(x1, z1); el.push(`<rect x="${a.toFixed(1)}" y="${b.toFixed(1)}" width="${(c - a).toFixed(1)}" height="${(d - b).toFixed(1)}" fill="${f}"/>`); };
  r(PLAZA.x0, TOWN.x1, PLAZA.z0, PLAZA.z1, '#eeeeee');
  for (const b of TOWN_B) r(b.x0, b.x1, b.z0, b.z1, b.kind === 'house' ? '#8f9499' : b.kind === 'shop' ? '#e2782c' : b.kind === 'tolet' ? '#5a5f65' : b.kind === 'zip' ? '#2fbfd3' : b.kind === 'stable' ? '#a3957f' : '#b85d1e');
  for (const s of HUB.services.filter(q => !q.shop)) { const [x, y] = P2(s.x, s.z); el.push(`<rect x="${x - 3}" y="${y - 1.5}" width="6" height="3" fill="#e2782c"/>`); }
  for (const n of HUB.npcs) { const [x, y] = P2(n.x, n.z); el.push(`<circle cx="${x}" cy="${y}" r="2" fill="${n.giver ? '#ffd23a' : '#1fd3e8'}" stroke="#111" stroke-width=".6"/>`); }
  for (const g of GATES) { const [x, y] = P2(g.x, g.z); el.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="#b85d1e" stroke-width="1.4"/>`); }
  const t = (x, z, s) => { const [a, b] = P2(x, z); el.push(`<text x="${a}" y="${b}" font-size="5.6" text-anchor="middle" fill="#111" font-weight="700">${s}</text>`); };
  t(-40, 4, 'PLAZA'); t(-72, -27, 'ROOK'); t(-72, 30, 'WEAPONS'); t(-117, -31, 'ZIP'); t(-22, -55, 'STABLE'); t(-95, 3, 'MAIN ST');
  el.push(`<text x="2" y="138" font-size="6.6" fill="#fff">176×176 m · ${houses} houses · services ≤ ${Math.round(townSpan)} m apart</text></svg>`);
  return el.join('');
}
const gTot = G_.reduce((a, g) => a + g.hours, 0);
const VIEWS = {
  plan() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 3 · 500 m CELL · TOP-DOWN PLAN</b><span>North up. WEST = the town and the toys, no enemies. NE = bands 1–4. SE = band 5 (the stealth yard) and band 6 on top; the gauntlet and the Crate Titan alone in the bottom half. ! quest · ✦ beacon · ★ vista · ◆ cache · ● Gold 1×1 · ⛩ town gate.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'plan');
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>IT FITS: town ${(B_.town / 2500).toFixed(1)} % of the cell, west ${Math.round((B_.town + B_.west + B_.cand) / 1250)} % used, east ${Math.round((B_.band + B_.set) / 1250)} % · ${P.packs.length} packs, ${S_.total} enemies</h3>
      <table><tr><td style="width:132px">${townSvg()}</td><td>
      <b>The town</b> (was a r 28 plaza): the <b>gate plaza</b> inside the east gate holds the quest corner (G1 Yard Boss L1–6, G2 Surveyor L7–12, G3 Shift Boss L13–20 at the board), contracts, the trophy wall and feats; <b>Main Street</b> is the shop row: Tinker Rook (vendor, UPGRADES, BENCH), the weapons shop, three empty fronts for later shops, the zip house. The stable and the stable hand at the <b>Stable Gate</b> open onto the paddock and the riding course. Six gates; only the <b>east</b> one crosses the seam into combat.</td></tr></table>
      <b>Combat</b>: NE snakes b1 → b2 → b3 → b4 through arches · road gates into b1, b4, b5 and b6 · SE top: the yard IS band 5 (beacons on its corner towers), band 6 its own section · SE bottom: only the gauntlet (L16–18, Foreman Unit 7) and the Crate Titan L20 in the very bottom right. Elites: Big Pallet L6 (b2 pit), Vault Warden L12 (vault, b4), Foreman Unit 7 L18, night: ${ELITES.map(e => `${e.name} L${e.lv} (b${e.band})`).join(', ')}.`;
    render(ortho);
  },
  place2() { VIEWS.place(true); },
  place(south) {
    const W = VW(); if (south) setFrame(-2, 250, -2, 250); else setFrame(-2, 250, -250, 2); signs.visible = false; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = true;
    scene.fog = null; $('cap').innerHTML = `<b>ROUND 3 · CONTENT PLACEMENT · ${south ? 'SOUTH-EAST (band 5 yard, band 6, gauntlet, Titan)' : 'NORTH-EAST (bands 1–4)'}</b><span>Every pack (rings = its aware radius; dark blue = swaps to night shift after dark), Mk I–III = its level in the band, ◆ elites, ■ loot chest, ▪ loot crate, ● Gold 1×1, ! quest target and its lock, ✦ storm beacon. Grey blocks = cover.</span>`;
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'place');
    $('panel').hidden = false; $('foot').hidden = true;
    const F = P.fit;
    $('panel').innerHTML = `<h3>DOES IT FIT? Yes. Golden-ratio XP: ~${Math.round(gTot)} h to L20, ${(G_[4].hours + G_[5].hours).toFixed(0)} h of it in bands 5–6</h3><table>
      <tr><td><b>Band</b></td><td><b>Common</b></td><td class="num"><b>Space</b></td><td class="num"><b>Slots</b></td><td class="num"><b>Packs</b></td><td class="num"><b>Pool</b></td><td class="num"><b>Back</b></td><td class="num"><b>No-wait</b></td><td class="num"><b>Hours</b></td></tr>
      ${F.map((f, i) => `<tr><td>${f.band}</td><td>${f.enemy} ×${BANDS[i].packSize}</td><td class="num">${f.spacing} m</td><td class="num">${f.capacity}/${f.need}</td><td class="num">${f.placed}</td><td class="num">${G_[i].pool}</td><td class="num">${G_[i].loopBackS} s</td><td class="num">${G_[i].ceiling}/min</td><td class="num">${G_[i].hours}</td></tr>`).join('')}</table>
      Slots = lattice capacity / packs + lair. Pool = enemies in a Mk tier. Back = leaving a tier's first pack to returning, at 2.5 kills/min (≥ 90 s respawn: nobody waits). No-wait = the fastest kill rate a tier feeds with no waiting. Hours at 2.5/min on the 1.618 curve; band 6 carries L19 → 20.<br>
      <b>Phone</b>: ${S_.total} commons by day; at most ${S_.view} in a portrait view (33°, 100 m), ${S_.awake60} within 60 m, ${S_.near150} inside 150 m. · <b>Cover</b>: ${P.cover.length} pieces, p95 ${R2_.p95} m to cover.`;
    render(ortho);
  },
  budget() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = false; budgetOnly.visible = true; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 3 · AREA BUDGET (used vs free)</b><span>Blue = the town · orange = west toys · teal = west support (paddock, the Rock) · yellow→red = level bands 1–6 · maroon = combat set pieces · slate = roads, strip · bare grid = free. Pink = 16 m edge blend. White = 62.5 m render tiles.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'budget');
    const pct = n => (n / 2500).toFixed(1) + ' %';
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>250,000 m² cell · 1 m raster of layout.js · round 2 in brackets</h3><table>
      <tr><td>${sw(KIND.town)}Town (hub in round 2)</td><td class="num">${fmt(B_.town)} m²</td><td class="num">${pct(B_.town)}</td><td class="num">(1.0 %)</td></tr>
      <tr><td>${sw(KIND.west)}West toys</td><td class="num">${fmt(B_.west)} m²</td><td class="num">${pct(B_.west)}</td><td class="num">(17.8 %)</td></tr>
      <tr><td>${sw(KIND.cand)}West support (paddock, the Rock)</td><td class="num">${fmt(B_.cand)} m²</td><td class="num">${pct(B_.cand)}</td><td class="num">(2.2 %)</td></tr>
      <tr><td>${sw(KIND.band)}East level bands</td><td class="num">${fmt(B_.band)} m²</td><td class="num">${pct(B_.band)}</td><td class="num">(31.4 %)</td></tr>
      <tr><td>${sw(KIND.set)}East set pieces (yard, gauntlet, pit, vault, Titan)</td><td class="num">${fmt(B_.set)} m²</td><td class="num">${pct(B_.set)}</td><td class="num">(8.3 %)</td></tr>
      <tr><td>${sw(0x3c4148)}Roads, strip, wall</td><td class="num">${fmt(B_.circ)} m²</td><td class="num">${pct(B_.circ)}</td><td class="num">(14.4 %)</td></tr>
      <tr><td>${sw(0xc3c6c9)}<b>Free floor</b></td><td class="num"><b>${fmt(B_.free)} m²</b></td><td class="num"><b>${pct(B_.free)}</b></td><td class="num">(24.9 %)</td></tr>
      <tr><td colspan="4"><h3>ZONES</h3>${ZONES.map(z => `${z.name.toLowerCase()} <b>${fmt(zoneArea(z))}</b>`).join(' · ')} m².</td></tr>
      <tr><td colspan="4">0 m² extra: the Training Vault's 4 rooms (${INTERIORS[0].w}×${INTERIORS[0].d} m at y −40) and the squeeze cave under the Rock · night shift on day spawn points · rare variants as a roll · vistas, Gold 1×1s on roofs and structures.</td></tr></table>`;
    render(ortho);
  },
  aerial() { full(); signScale(.55); for (const sp of packSigns) sp.visible = false; persp.near = 2; persp.fov = 78; persp.position.set(-40, 470, 540); persp.lookAt(-10, 0, -45); persp.updateProjectionMatrix(); caption('AERIAL · round 3 · the whole cell from the south, 470 m up', `The walled town fills the middle of the west (${houses} houses, six gates); the toys ring it. East: bands 1–4 in the NE, the stealth yard and band 6 in the SE top half, the gauntlet and the Titan alone at the bottom.`); render(persp); },
  gate() { full(); persp.fov = 64; persp.position.set(-25, EYE, 10); persp.lookAt(-43, 2.4, -20); signsWithin(70); caption('GROUND VIEW · TOWN · THE GATE PLAZA · eye 1.7 m', 'A few steps inside the east gate: the quest corner, the board with its three tier givers (yellow ! = a level 1 may take it, grey = locked). Behind you: the contracts board, the trophy wall, the market stalls and the obelisk; Main Street\'s shops open off the plaza\'s west side.'); render(persp); },
  street() { full(); persp.fov = 76; persp.position.set(-140, EYE, 84); persp.lookAt(-140, 5, 20); signsWithin(90); caption('GROUND VIEW · TOWN · PARK LANE · from the Park Gate', 'A residential lane: 12 m between two- to four-storey houses with pitched roofs, back alleys every ~40 m, Main Street ahead. At eye height the town wall is out of sight from most of the town.'); render(persp); },
  shops() { full(); persp.fov = 66; persp.position.set(-40, EYE, 1); persp.lookAt(-120, 4, 0); signsWithin(80); caption('GROUND VIEW · TOWN · MAIN STREET (THE SHOP ROW)', 'From the plaza looking west: Tinker Rook (UPGRADES, BENCH) on the right, the weapons shop on the left, then three empty fronts for later shops and the zip house, where the grapple tower\'s zipline lands on the roof.'); render(persp); },
  west() { full(); persp.fov = 66; persp.position.set(LOOKOUT.x + 3, LOOKOUT.y + EYE, LOOKOUT.z - 6); persp.lookAt(-178, 16, -80); signsWithin(220); caption('GROUND VIEW · WEST TOYS · from the Rock\'s lookout (16 m)', 'Cave Hill became the Rock, the town\'s crag: from its bench the grapple tower, the hook mast, the water tank and the stacked movers spiral read in one portrait frame, with the town roofs on the right.'); render(persp); },
  ne1() { shot([24, -122], 30, Math.PI / 2, 70); signsWithin(90); caption('GROUND VIEW · NE · BAND 1 → BAND 2', 'From band 1\'s top tier (Crate Mites, L3) through the arch into band 2: Pallet Jacks among grey walls; every band change in the NE is an arch with the band\'s name and levels on it.'); render(persp); },
  ne2() { shot([224, -122], 30, -Math.PI / 2, 70); signsWithin(100); caption('GROUND VIEW · NE · BAND 3 → BAND 4 · the vault', 'From band 3\'s top tier through the arch into band 4: Welder bays, and the Training Vault gatehouse at the band\'s east edge.'); render(persp); },
  se() { shot([126, 66], 36, Math.PI, 70); signsWithin(100); caption('GROUND VIEW · SE · BAND 6 → THE STEALTH YARD (band 5)', 'Band 6 is its own section: Arc Sentry pairs behind 3 m arc screens and half-height covers. Beyond the yard\'s west gate, band 5\'s Riveter patrols and their cones; beacon towers on the yard corners.'); render(persp); },
  gauntlet() { full(); persp.fov = 60; persp.position.set(62, EYE, 132); persp.lookAt(62, 3, 182); signsWithin(120); caption('GROUND VIEW · SE BOTTOM · THE GAUNTLET (L16–18)', 'Through the gauntlet gate in the SE half wall: the wave arena, 56 m floor and seating back to r 42, alone in the bottom half with the Titan; Foreman Unit 7 (L18) is the finale.'); render(persp); },
  boss() { full(); persp.fov = 62; persp.position.set(108, EYE + .4, 192); persp.lookAt(198, 6, 192); signsWithin(140); caption('GROUND VIEW · CRATE TITAN L20 · on the approach', 'The very bottom right: the 39 × 16 m approach for the in-engine intro (cyan camera pads) into the r 28 floor, entered from the forecourt next to the gauntlet.'); render(persp); },
  compare() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 2 → ROUND 3 · same scale, north up</b><span>Top: round 2 (c6063ad0ce). Bottom: round 3. Hub r 28 → a 176 m walled town · toys rebalanced round it · NE = bands 1–4 · SE = band 5 yard + band 6 over the gauntlet and the Titan.</span>';
    const top = $('cap').offsetHeight, s = Math.min(W, Math.floor((VH() - top) / 2));
    const r1 = $('r1'); r1.hidden = false; Object.assign(r1.style, { top: top + 'px', width: s + 'px', height: s + 'px', left: (W - s) / 2 + 'px', backgroundSize: `${s}px ${s * 874 / 402}px`, backgroundPosition: `0 -${s * 77 / 402}px` });
    layoutCanvas(s, s, top + s); renderer.domElement.style.left = (W - s) / 2 + 'px'; planLabels(s, top + s, 'plan'); $('labels').style.left = (W - s) / 2 + 'px';
    $('panel').hidden = true; $('foot').hidden = true;
    for (const [id, y, t] of [['t1', top + 4, 'ROUND 2'], ['t2', top + s + 4, 'ROUND 3']]) { const d = $(id); d.hidden = false; d.textContent = t; d.style.top = y + 'px'; }
    render(ortho);
  },
};
// a clear eye-height shot of `at` from about `d` m away in direction `a` (cover-aware), looking through it
function shot(at, d, a, fov) {
  const segD = (c, p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], t = Math.max(0, Math.min(1, ((c.x - p[0]) * dx + (c.z - p[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(p[0] + t * dx - c.x, p[1] + t * dz - c.z); };
  let cam = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
  search: for (const dd of [d, d + 8, d - 8, d + 16]) for (let k = 0; k <= 10; k++) for (const sgn of [1, -1]) {
    const aa = a + sgn * k * .07, c = [at[0] + Math.cos(aa) * dd, at[1] + Math.sin(aa) * dd];
    const far = [at[0] + (at[0] - c[0]) / dd * 30, at[1] + (at[1] - c[1]) / dd * 30];
    if (Math.abs(c[1]) < 10 || P.cover.some(q => Math.hypot(q.x - c[0], q.z - c[1]) < 7) || P.cover.some(q => segD(q, c, at) < 4.5 || segD(q, at, far) < 3.5)) continue;
    cam = c; break search;
  }
  full(); persp.fov = fov; persp.position.set(cam[0], EYE, cam[1]);
  const dx = at[0] - cam[0], dz = at[1] - cam[1], n = Math.hypot(dx, dz); persp.lookAt(at[0] + dx / n * 40, 2.6, at[1] + dz / n * 40);
}
function full() {
  layoutCanvas(VW(), VH(), 0); renderer.domElement.style.left = '0px'; $('labels').style.left = '0px'; $('r1').hidden = true; $('t1').hidden = true; $('t2').hidden = true;
  signs.visible = true; signScale(.8); persp.near = .3; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = false;
  scene.fog = new THREE.Fog(0xa9c4dc, 350, 1400); $('labels').innerHTML = ''; $('panel').hidden = true;
  persp.aspect = VW() / VH(); persp.updateProjectionMatrix();
}
function signsWithin(d) { for (const sp of signList) { const p = new THREE.Vector3(); sp.getWorldPosition(p); sp.visible = p.distanceTo(persp.position) <= (packSigns.includes(sp) ? 32 : d); } }
function signScale(f) { for (const sp of signList) sp.scale.set(sp.userData.k[0] * f, sp.userData.k[1] * f, 1); }
function caption(title, text) {
  $('cap').innerHTML = `<b>${title}</b><span>${text}</span>`;
  $('foot').hidden = false; $('foot').textContent = 'Showcase Template · round 3 grey blockout · art/showcase-template/round-3-blockout · labels are burned in';
}
const ui = $('ui'); for (const k of [...Object.keys(VIEWS), 'orbit']) { const o = document.createElement('option'); o.textContent = k; ui.appendChild(o); }
ui.onchange = () => show(ui.value);
function show(name) {
  current = name; controls.enabled = name === 'orbit';
  for (const id of ['r1', 't1', 't2']) $(id).hidden = true; renderer.domElement.style.left = '0px'; $('labels').style.left = '0px';
  if (name === 'orbit') { full(); caption('ORBIT · drag to look around', ''); persp.position.set(0, 220, 380); controls.target.set(0, 0, 0); controls.update(); return; }
  VIEWS[name]();
}
renderer.setAnimationLoop(() => { if (current === 'orbit') { controls.update(); render(persp); } });
show('plan');
window.lab = { show: n => { ui.value = n; show(n); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
  stats: () => ({ budget: B_, fit: P.fit, grind: G_, onScreen: S_, reach: [R2_, R1_], townSpan, houses, townBuildings: TOWN_B.length, cover: P.cover.length, chests: P.chests.length, crates: P.crates.length, quests: P.quests.length, lairs: P.lairs, packs: P.packs.length,
    night: P.packs.filter(p => p.night).length }) };
window.labReady = true;
