// Showcase Template grey blockout lab: builds the measured layout in layout.js as dev-map blocks and frames the
// captures (plan board, budget board, aerial, ground views at 1.7 m eye height). window.lab.show(name) for capture.mjs.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REAL, HALF, STRIP, RING, AVENUE_HALF, ZONES, INTERIORS, CHAIN, SECRETS } from './layout.js';

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

// ---------- footprint maths (also the budget) ----------
function inZoneRaw(zn, x, z) { return inZone(zn, x, z); }
function inZone(zn, x, z) {
  if (zn.shape === 'rect') return x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1;
  if (zn.shape === 'disc') return (x - zn.x) ** 2 + (z - zn.z) ** 2 <= zn.r ** 2;
  if (zn.shape === 'stadium') { const dx = Math.max(0, Math.abs(x - zn.x) - zn.halfLen); return dx * dx + (z - zn.z) ** 2 <= zn.r ** 2; }
  if (zn.shape === 'rects') return zn.list.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  return false;
}
function zoneArea(zn) {
  if (zn.shape === 'rect') return (zn.x1 - zn.x0) * (zn.z1 - zn.z0);
  if (zn.shape === 'disc') return Math.PI * zn.r ** 2;
  if (zn.shape === 'stadium') return 2 * zn.halfLen * 2 * zn.r + Math.PI * zn.r ** 2;
  return zn.list.reduce((a, [x0, x1, z0, z1]) => a + (x1 - x0) * (z1 - z0), 0);
}
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
function isCirculation(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), m = Math.max(ax, az), r = Math.hypot(x, z);
  if (m >= STRIP.inner) return true;                                   // strip + wall
  if (r >= RING.inner && r <= RING.outer) return true;                 // hub ring road
  if ((ax <= AVENUE_HALF && r > RING.outer) || (az <= AVENUE_HALF && r > RING.outer)) return true;  // avenues
  return false;
}
function budget() {
  const out = { west: 0, cand: 0, set: 0, band: 0, circ: 0, free: 0, overlap: 0 };
  for (let x = -249.5; x < 250; x++) for (let z = -249.5; z < 250; z++) {
    const hits = ZONES.filter(zn => inZone(zn, x, z));
    if (hits.length > 1) out.overlap++;
    if (hits.length) out[hits[0].kind]++;
    else if (isCirculation(x, z)) out.circ++;
    else out.free++;
  }
  return out;
}
function chainLength() { let d = 0; for (let i = 1; i < CHAIN.length; i++) d += Math.hypot(CHAIN[i].x - CHAIN[i - 1].x, CHAIN[i].z - CHAIN[i - 1].z); return d; }

// ---------- the world ----------
function buildGround() {
  // the deck outside the cell: road gap (62.5 m), road on its centre line, neighbour cells beyond
  flatRect(-900, 900, -900, 900, -0.05, M.outside, { shadow: false });
  const roadC = HALF + 31.25;
  for (const s of [-1, 1]) {
    flatRect(-900, 900, s * roadC - 7.5, s * roadC + 7.5, 0.01, M.asphalt);
    flatRect(s * roadC - 7.5, s * roadC + 7.5, -900, 900, 0.01, M.asphalt);
  }
  const nb = HALF + 62.5;
  for (const [cx, cz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = cx * (2 * HALF + 62.5), z = cz * (2 * HALF + 62.5);
    box(500, 0.6, 500, x, -0.4, z, M.grey, { edges: true, shadow: false });
    if (Math.abs(cx) + Math.abs(cz) === 1) sign('NEIGHBOUR CELL', '500 m shard, 62.5 m road gap', x - cx * 200, 14, z - cz * 200, 40);
  }
  void nb;
  // the cell floor: 1 m dev grid
  const g = new THREE.PlaneGeometry(500, 500); g.rotateX(-Math.PI / 2);
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(50, 50);
  add(g, new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), 0, 0, 0, { shadow: false });
  // perimeter strip, ring road, avenues, entry aprons
  const y = 0.03;
  flatRect(-STRIP.outer, STRIP.outer, -STRIP.outer, -STRIP.inner, y, M.asphalt); flatRect(-STRIP.outer, STRIP.outer, STRIP.inner, STRIP.outer, y, M.asphalt);
  flatRect(-STRIP.outer, -STRIP.inner, -STRIP.inner, STRIP.inner, y, M.asphalt); flatRect(STRIP.inner, STRIP.outer, -STRIP.inner, STRIP.inner, y, M.asphalt);
  flatDisc(0, 0, RING.outer, y, M.asphalt, RING.inner);
  flatRect(-AVENUE_HALF, AVENUE_HALF, -STRIP.inner, -RING.outer + 1, y, M.asphalt); flatRect(-AVENUE_HALF, AVENUE_HALF, RING.outer - 1, STRIP.inner, y, M.asphalt);
  flatRect(-STRIP.inner, -RING.outer + 1, -AVENUE_HALF, AVENUE_HALF, y, M.asphalt); flatRect(RING.outer - 1, STRIP.inner, -AVENUE_HALF, AVENUE_HALF, y, M.asphalt);
  for (const s of [-1, 1]) { flatRect(-7.5, 7.5, s > 0 ? 235 : -262, s > 0 ? 262 : -235, 0.04, M.asphalt); flatRect(s > 0 ? 235 : -262, s > 0 ? 262 : -235, -7.5, 7.5, 0.04, M.asphalt); }
  // perimeter wall with the four 8 m midpoint entries and gate pylons
  const wl = HALF - 4 - 0.5; // wall run from the corner to the gate edge
  for (const s of [-1, 1]) for (const side of [-1, 1]) {
    box(wl, 5, 1, side * (4 + wl / 2), 0, s * 249.5, M.orange); box(1, 5, wl, s * 249.5, 0, side * (4 + wl / 2), M.orange);
    box(3, 9, 3, side * 5.5, 0, s * 248.5, M.orangeDark); box(3, 9, 3, s * 248.5, 0, side * 5.5, M.orangeDark);
  }
}

function buildHub() {
  flatDisc(0, 0, 40, 0.04, M.light);
  box(10, 2, 10, 0, 0, 0, M.grey);
  add(new THREE.CylinderGeometry(1.4, 3.6, 30, 4), M.orange, 0, 17, 0, { ry: Math.PI / 4, edges: true });   // obelisk
  ringWall(0, 18, [[5.4, 0], [5.4, 1], [6, 1], [6, 0]], M.grey); flatDisc(0, 18, 5.4, 0.6, M.water);       // fountain
  box(7, 3.4, .5, -14, 0, -22, M.orange); sign('QUEST BOARD', '', -14, 6, -22, 10);
  box(8, 3, 5, 16, 0, -20, M.grey); box(9, .4, 6.5, 16, 3, -20, M.orange);                                  // SUPPLY vendor
  box(16, 4, .6, -24, 0, 10, M.orange); for (let i = 0; i < 6; i++) box(1.6, 1.6, .4, -30.5 + i * 2.6, 1.4, 9.5, M.white, { shadow: false }); // trophy wall
  box(5, 3, .4, 22, 0, 12, M.orangeDark); // feats board (joke titles)
  box(6, 3, .4, -22, 0, -10, M.orangeDark); sign('CONTRACTS', '', -22, 6, -10, 10);  // contract board
  box(8, 3.4, 6, 26, 0, -6, M.grey); box(9, .4, 7, 26, 3.4, -6, M.cyan); sign('UPGRADES', '', 26, 7, -6, 9);  // upgrade shop
  for (const [x, z] of [[-10, -16], [12, -14], [8, 24], [-6, 26]]) capsule(x, z, 1.8, .4, M.grey);          // givers
  for (let a = 0; a < 8; a++) cyl(.2, .2, 6, Math.cos(a * Math.PI / 4) * 37, 0, Math.sin(a * Math.PI / 4) * 37, M.dark, { seg: 6 });
  sign('01 HUB', '⌀80 m · quests, contracts, vendor, upgrades', 0, 36, 0, 30);
}

function buildRange() {
  flatRect(-95, -20, -212, -112, 0.04, M.light);
  box(75, 1.1, 1.2, -57.5, 0, -120, M.orangeDark);                                  // firing line bench
  for (let i = 0; i <= 5; i++) box(.5, 1.4, 76, -95 + i * 15, 0, -158, M.grey);      // lane dividers
  const lanes = ['SWORD', 'SPEAR', 'BOW', 'CROSSBOW', 'LEVER RIFLE'];
  for (let l = 0; l < 5; l++) {
    const cx = -95 + 15 * (l + .5);
    if (l < 2) { capsule(cx - 3, -125, 1.9, .45, M.orange); capsule(cx + 3, -128, 1.9, .45, M.orange); capsule(cx, -132, 1.9, .45, M.hazard); }
    else for (let d = l === 4 ? 25 : 10; d <= (l === 4 ? 75 : 50); d += l === 4 ? 25 : 10) { box(1.4, .1, .2, cx, 0, -120 - d, M.grey); box(1.2, 1.6, .3, cx + (d % 20 ? 2 : -2), 0, -120 - d, M.white); }
    sign(lanes[l], '', cx, 4.5, -117, 10);
  }
  box(75, 10, 14, -57.5, 0, -205, M.grey);                                           // berm
  sign('02 WEAPON RANGE', '75×100 m · 10–50 m, rifle to 75 m', -57.5, 16, -165, 34);
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

function buildMovers() {
  flatRect(112, 190, -108, -28, 0.04, M.light);
  // stepping route climbing 0 -> 18 m toward the cistern
  const route = [[125, -40, 1], [135, -50, 2.5], [128, -64, 4], [138, -76, 5.5], [152, -82, 7], [166, -74, 8.5], [176, -62, 10], [172, -48, 11.5], [182, -40, 13], [186, -54, 14.5], [186, -70, 16], [192, -78, 17.5]];
  route.forEach(([x, zz, y], i) => box(6, 1, 6, x, y - 1, zz, i % 3 === 1 ? M.cyan : M.orange));
  for (const [x, zz] of [[150, -45], [160, -95]]) { box(6, .6, 6, x, 6, zz, M.orange); box(.4, 14, .4, x - 3.2, 0, zz, M.dark); box(.4, 14, .4, x + 3.2, 0, zz, M.dark); }   // lifts
  for (const [x, zz] of [[120, -90], [142, -100]]) { cyl(4, 4, .6, x, 2, zz, M.orange); box(8, .6, .8, x, 2.6, zz, M.dark); cyl(.4, .4, 2, x, 0, zz, M.dark); } // spinners
  box(30, .6, 3, 150, 0, -35, M.dark); box(3, .6, 24, 118, 0, -66, M.dark);   // conveyors
  for (const [x, zz] of [[135, -32], [165, -32], [120, -50], [178, -98]]) cyl(1.5, 1.5, .4, x, 0, zz, M.cyan);  // jump pads
  box(8, .8, 4, 170, 4, -100, M.orange);                                       // slider
  sign('05 MOVERS PARK', '78×80 m · climbs 0 → 18 m', 151, 24, -68, 30);
  // cistern + rope bridge
  box(37, 18, 40, 213.5, 0, -75, M.orange);
  for (const s of [-1, 1]) box(37, 1.1, .2, 213.5, 18, -75 + s * 20, M.white); box(.2, 1.1, 40, 232, 18, -75, M.white);
  cable(sag([193, 17.4, -78], [195, 18, -76], .2)); cable(sag([186, 15.5, -70], [195, 18.1, -70], 1.2), 0x6b4a2a, .25);
  sign('CISTERN', '18 m · rope bridge · vista', 213, 27, -75, 24);
  // hook mast and grapple tower
  box(1.4, 28, 1.4, 213, 0, -22, M.dark); add(new THREE.SphereGeometry(1.2, 12, 8), M.cyan, 213, 28.5, -22);
  flatRect(197, 227, 8, 38, 0.04, M.light);
  box(14, 45, 14, 212, 0, 23, M.orange);
  for (let y = 9; y < 45; y += 9) box(18, .6, 18, 212, y, 23, M.orangeDark);
  for (const [dx, dz] of [[-9, -9], [9, -9], [9, 9], [-9, 9]]) add(new THREE.SphereGeometry(.9, 10, 8), M.cyan, 212 + dx, 30, 23 + dz);
  flatRect(198, 226, 9, 37, .5, new THREE.MeshStandardMaterial({ color: 0x333333, wireframe: true }));          // nets
  cable(sag([212, 45, 23], [284, 2.5, -102], 7, 20));                                                            // zipline to the mount post
  sign('06 GRAPPLE TOWER', '45 m · hops ≤ 38 m · zip 146 m', 212, 54, 23, 32);
}

function buildStealth() {
  flatRect(125, 225, 108, 212, 0.04, M.light);
  const wall = (x0, z0, x1, z1) => box(Math.max(.6, Math.abs(x1 - x0)), 2.6, Math.max(.6, Math.abs(z1 - z0)), (x0 + x1) / 2, 0, (z0 + z1) / 2, M.orange);
  wall(125, 108, 145, 108); wall(155, 108, 225, 108); wall(225, 108, 225, 212); wall(145, 212, 225, 212); wall(125, 108, 125, 195);   // gates N (x 150) + SW
  for (let i = 0; i < 6; i++) box(2, 2.2, 24, 134 + (i % 3) * 9, 0, 125 + Math.floor(i / 3) * 44 + (i % 2) * 8, M.grey);                 // tall cover walls
  for (let i = 0; i < 46; i++) { const x = 162 + rnd() * 58, zz = 114 + rnd() * 92, h = 1 + Math.floor(rnd() * 3) * 1.25; box(2.4, h, 2.4, x, 0, zz, rnd() < .3 ? M.grey : M.orange, { ry: rnd() < .5 ? 0 : .3 }); }
  for (const [x, zz, a] of [[175, 130, 0.4], [205, 160, 2.5], [180, 190, -1.2], [150, 150, 1.6]]) {
    capsule(x, zz, 1.9, .42, M.hazard);
    const g = new THREE.CircleGeometry(15, 24, -Math.PI / 6, Math.PI / 3); g.rotateX(-Math.PI / 2);
    add(g, M.cone, x, .15, zz, { ry: a, shadow: false });
  }
  box(8, 4, 6, 212, 0, 200, M.orangeDark); sign('KEYCARD', '', 212, 8, 200, 10);
  sign('07 STEALTH YARD', 'band 5 · storm hour · 4 patrols', 175, 14, 160, 34);
  sign('TALL COVER', '', 142, 6, 160, 12);
}

function buildWaterVault() {
  // 12 portal vault
  flatRect(25, 75, 148, 200, 0.04, M.light);
  box(30, 12, 20, 50, 0, 182, M.orange); box(10, 9, 1, 50, 0, 171.5, M.dark, { edges: false });
  add(new THREE.TorusGeometry(4, .5, 10, 40), M.portal, 50, 5, 170);
  for (let i = 0; i < 4; i++) box(14, .3 * (i + 1), 2, 50, 0, 165 - i * 2, M.grey);
  sign('12 PORTAL VAULT', 'plate room 60×60 m at y −60', 50, 19, 182, 30);
}

function buildGauntlet() {
  // 08 gauntlet amphitheatre
  flatDisc(-160, 172, 28, 0.05, M.dirt);
  ringWall(-160, 172, [[28, 0], [28, 1.2], [32, 1.2], [32, 2.4], [36, 2.4], [36, 3.6], [40, 3.6], [40, 5], [42, 5], [42, 0]], M.orange, [[Math.PI / 2, .3], [-Math.PI / 2 + .9, .3]]);
  for (let i = 0; i < 10; i++) capsule(-160 + Math.cos(i) * 18, 172 + Math.sin(i * 1.7) * 16, 1.7, .4, M.bot);
  capsule(-160, 176, 3.4, .9, M.hazard);
  sign('08 ELITE GAUNTLET', 'band 6 · waves + Foreman Unit 7', -160, 18, 172, 34);
}

function buildArena() {
  box(16, .4, 39, -160, 0, 111.5, M.light); for (const s of [-1, 1]) { box(4, 1, 4, -160 + s * 13, 6, 89, M.cyan); }   // approach + camera pads on the rim
  flatDisc(-160, 55, 28, 0.05, M.light);
  flatDisc(-160, 55, 33, 0.06, M.hazard, 29);
  ringWall(-160, 55, [[34, 0], [34, 6], [38, 6], [38, 0]], M.orange, [[-Math.PI / 2, .22]]);
  for (const [x, z] of [[-20, -10], [16, 14], [-8, 18]]) flatDisc(-160 + x, 55 + z, 4, 0.07, M.hazard);
  box(6, 6, 6, -160, 0, 55, M.orangeDark); box(5, 5, 5, -160, 6, 55, M.orange); box(3.5, 3.5, 3.5, -160, 11, 55, M.orangeDark);
  box(3, 3, 3, -165, 6, 55, M.orange); box(3, 3, 3, -155, 6, 55, M.orange);
  sign('09 BOSS · L20', 'r 28 floor (Driftwood r 22 + 6) · the Crate Titan', -160, 24, 55, 36);
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

function buildHill() {
  add(new THREE.CylinderGeometry(20, 49, 16, 4), M.grey, -180, 8, -180, { ry: Math.PI / 4, edges: true });
  box(3, .6, 1, -180, 16, -180, M.orangeDark); box(5, 3.5, 1, -180, 0, -145.8, M.dark, { edges: false }); box(1, 5, 4, -145.5, 0, -180, M.portal, { edges: false });
  for (let i = 0; i < 7; i++) box(4, 2.2 * (i + 1) * .33, 3, -170 + i * 3, 0, -146 + (i % 2), M.grey);   // scramble steps
  box(.4, 16, .6, -205, 0, -152, M.dark);   // ladder
  sign('CAVE HILL', 'climb · vista · cave + squeeze', -180, 26, -180, 28);
}

function buildStrip() {
  sign('PERIMETER STRIP', 'the safe ring road', -120, 6, 242, 26);
  for (const q of SECRETS) q.k === 'b' ? box(2, .5, .7, q.x, q.y, q.z + 2, M.white) : q.k === 'c' ? box(.9, .9, .9, q.x, q.y, q.z, M.cyan) : box(1.4, 1, .9, q.x, q.y, q.z, M.glow);
}


// ---------- the east half: level bands, walls, mini-bosses, checkpoint cards ----------
const BAND_TINT = [0xe9e2b0, 0xe6cf98, 0xe0b483, 0xd8956f, 0xcd765f, 0xbf5852];
function buildEast() {
  for (const zn of ZONES.filter(q => q.kind === 'band')) {
    const rects = zn.shape === 'rects' ? zn.list : [[zn.x0, zn.x1, zn.z0, zn.z1]];
    for (const [x0, x1, z0, z1] of rects) {
      flatRect(x0, x1, z0, z1, 0.02, mat(BAND_TINT[zn.band - 1]));
      const n = Math.max(2, Math.round((x1 - x0) * (z1 - z0) / 3500));
      for (let i = 0; i < n; i++) {
        const x = x0 + 8 + rnd() * (x1 - x0 - 16), z = z0 + 8 + rnd() * (z1 - z0 - 16);
        if (ZONES.some(q => q.kind === 'set' && inZoneRaw(q, x, z)) || Math.abs(z) < 12) continue;
        cyl(1.4, 2, 1.6, x, 0, z, mat(0x34383c), { seg: 6 });                                       // spawner
        for (let k = 0; k < 2 + zn.band; k++) capsule(x + Math.cos(k * 2.4) * (3 + k), z + Math.sin(k * 2.4) * (3 + k), 1.4 + zn.band * .15, .35 + zn.band * .04, M.hazard);
        for (let k = 0; k < 3; k++) box(1.6, 1.6, 1.6, x + 6 + k * 1.7, 0, z - 5 + (k % 2), M.orangeDark);  // crates
      }
    }
    const [cx, cz] = zoneCentre(zn);
    sign(zn.name, zn.band === 1 ? 'east gate · weakest packs' : zn.band === 6 ? 'last band before the boss' : 'level band', cx, 14, cz + (zn.band === 1 ? 30 : 0), 30);
  }
  // the seam wall (no enemy crosses into the west) and the walled east road (a safe corridor to the east entry)
  for (const s of [-1, 1]) box(1, 3, 185, 7.5, 0, s * 144.5, M.orange);
  for (const s of [-1, 1]) { box(19, 3, 1, 65.5, 0, s * 8.5, M.orange); box(73, 3, 1, 132.5, 0, s * 8.5, M.orange); box(53, 3, 1, 210.5, 0, s * 8.5, M.orange); }
  // mini-boss pits
  for (const zn of ZONES.filter(q => q.id[0] === 'M' && q.r)) {
    flatDisc(zn.x, zn.z, zn.r - 2, 0.05, M.dirt);
    ringWall(zn.x, zn.z, [[zn.r - 2, 0], [zn.r - 2, 1.4], [zn.r, 1.4], [zn.r, 0]], M.orangeDark, [[Math.PI / 2, .5], [-Math.PI / 2, .5]]);
    capsule(zn.x, zn.z, 3.6, 1, M.hazard); sign(zn.name, '', zn.x, 9, zn.z, 18);
  }
  // mini dungeon side door
  box(10, 6, 4, 216, 0, -118, M.grey); add(new THREE.TorusGeometry(2.6, .4, 10, 32), M.portal, 216, 3, -120.5);
  sign('MINI DUNGEON', 'portal · 40×50 m at y −40', 216, 11, -118, 20);
  // checkpoint cards: one per chain leg
  for (const c of CHAIN.filter(q => typeof q.n === 'number')) { box(.6, 3, .6, c.x + 4, 0, c.z + 4, M.white); box(1.6, 1, .2, c.x + 4, 3, c.z + 4, M.cyan); }
  // mount post
  box(10, 4, 6, -60, 0, -104, M.grey); for (let i = 0; i < 2; i++) box(2.4, 1.5, .7, -66 + i * 12, 0, -96, M.grey);
  sign('MOUNT POST', 'mount handed out', -60, 9, -102, 16);
}
buildGround(); buildHub();
place(buildRange, -110, 0, Math.PI);       // fires south now
place(buildRiding, -260, 0);
place(buildMovers, -344, 0);
place(buildStealth, 5, -78);
place(buildWaterVault, -115, -108);
place(buildGauntlet, 224, -54);
place(buildArena, 243, 350, -Math.PI / 2);  // approach from the west
place(buildHover, 0, 216);
place(buildHill, -20, 252);
buildStrip(); buildEast();

// ---------- plan overlays (chain ribbon, 50 m grid, budget fills, tile grid, edge band) ----------
const planOnly = new THREE.Group(), budgetOnly = new THREE.Group(); scene.add(planOnly, budgetOnly);
function ribbon(points, width, color, y, group) {
  const m = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: .9 });
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(len, width); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, m); mesh.position.set((ax + bx) / 2, y, (az + bz) / 2); mesh.rotation.y = -Math.atan2(bz - az, bx - ax); mesh.renderOrder = 10; group.add(mesh);
  }
}
function lineGrid(step, color, opacity, group, y = 60) {
  const pts = []; for (let v = -HALF; v <= HALF + .01; v += step) { pts.push(v, y, -HALF, v, y, HALF, -HALF, y, v, HALF, y, v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false })); l.renderOrder = 9; group.add(l);
}
lineGrid(50, 0x0b2a52, .55, planOnly);
ribbon(CHAIN.map(c => [c.x, c.z]), 1.8, 0xc3249b, 61, planOnly);
const KIND = { west: 0xe2782c, cand: 0x1fa7b8, set: 0x7d1d2c, band: 0xc9604f };
for (const zn of ZONES) {
  const m = new THREE.MeshBasicMaterial({ color: zn.kind === 'band' ? BAND_TINT[zn.band - 1] : KIND[zn.kind], transparent: true, opacity: zn.kind === 'band' ? .92 : .85, depthTest: false });
  if (zn.kind === 'band') m.color.offsetHSL(0, .25, -.18);
  const put = g => { g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; return mesh; };
  if (zn.shape === 'rect') { const mesh = put(new THREE.PlaneGeometry(zn.x1 - zn.x0, zn.z1 - zn.z0)); mesh.position.set((zn.x0 + zn.x1) / 2, zn.kind === 'band' ? 58.5 : 59, (zn.z0 + zn.z1) / 2); if (zn.kind === 'band') mesh.renderOrder = 5.5; budgetOnly.add(mesh); }
  if (zn.shape === 'disc') { const mesh = put(new THREE.CircleGeometry(zn.r, 64)); mesh.position.set(zn.x, 59, zn.z); budgetOnly.add(mesh); }
  if (zn.shape === 'stadium') { const g = new THREE.ShapeGeometry(stadiumShape(zn.x, zn.z, zn.halfLen, zn.r), 8); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.y = 59; mesh.renderOrder = 6; budgetOnly.add(mesh); }
  if (zn.shape === 'rects') for (const [x0, x1, z0, z1] of zn.list) { const mesh = put(new THREE.PlaneGeometry(x1 - x0, z1 - z0)); mesh.position.set((x0 + x1) / 2, zn.kind === 'band' ? 58.5 : 59, (z0 + z1) / 2); budgetOnly.add(mesh); }
}
{ // circulation fill + 16 m edge band + 62.5 m L0 tiles
  const cm = new THREE.MeshBasicMaterial({ color: 0x3c4148, transparent: true, opacity: .75, depthTest: false });
  const rect = (x0, x1, z0, z1, m, y = 58) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); mesh.renderOrder = 5; budgetOnly.add(mesh); };
  rect(-250, 250, -250, -STRIP.inner, cm); rect(-250, 250, STRIP.inner, 250, cm); rect(-250, -STRIP.inner, -STRIP.inner, STRIP.inner, cm); rect(STRIP.inner, 250, -STRIP.inner, STRIP.inner, cm);
  rect(-AVENUE_HALF, AVENUE_HALF, -STRIP.inner, -RING.outer, cm); rect(-AVENUE_HALF, AVENUE_HALF, RING.outer, STRIP.inner, cm); rect(-STRIP.inner, -RING.outer, -AVENUE_HALF, AVENUE_HALF, cm); rect(RING.outer, STRIP.inner, -AVENUE_HALF, AVENUE_HALF, cm);
  const g = new THREE.RingGeometry(RING.inner, RING.outer, 64); g.rotateX(-Math.PI / 2); const ring = new THREE.Mesh(g, cm); ring.position.y = 58; ring.renderOrder = 5; budgetOnly.add(ring);
  const band = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: .22, depthTest: false });
  const e = HALF - REAL.edgeBand; rect(-250, 250, -250, -e, band, 61); rect(-250, 250, e, 250, band, 61); rect(-250, -e, -e, e, band, 61); rect(e, 250, -e, e, band, 61);
  lineGrid(REAL.l0Tile, 0xffffff, .45, budgetOnly, 62);
}

// ---------- cameras and views ----------
const ortho = new THREE.OrthographicCamera(-262, 262, 262, -262, 1, 2000);
ortho.position.set(0, 800, 0); ortho.up.set(0, 0, -1); ortho.lookAt(0, 0, 0);
const persp = new THREE.PerspectiveCamera(62, 1, .3, 3000);
const controls = new OrbitControls(persp, renderer.domElement); controls.enabled = false;
const $ = id => document.getElementById(id);
const VW = () => document.documentElement.clientWidth, VH = () => document.documentElement.clientHeight;
const fmt = n => Math.round(n).toLocaleString('en-US');

function project(x, z, size) { return [(x + 262) / 524 * size, (z + 262) / 524 * size]; }
function planLabels(size, top, budgetMode) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  const off = { '01': [0, 15], 'C': [0, 14], '05': [0, 14], '06': [0, -14], 'K': [-50, -14], '12': [0, 0], '09': [0, 14], '08': [0, 20], '11': [0, -16], 'B1': [0, 30], 'B6': [-10, -30], 'B4': [0, -40], 'B5': [0, 40], 'B2': [20, 0], 'M6': [0, 18], 'M12': [-30, 0], 'M18': [-30, 0], 'DG': [0, 14], 'MP': [0, 12], 'H': [0, -10] };
  for (const zn of ZONES) {
    const [cx, cz] = zoneCentre(zn), [ox, oz] = off[zn.id] ?? [0, 0];
    const [px, pz] = project(cx + ox, cz + oz, size);
    const d = document.createElement('div'); d.className = 'lb ' + (zn.kind === 'cand' ? 'cand' : '');
    d.innerHTML = zn.kind === 'band' ? `${zn.name}<i>${fmt(zoneArea(zn))} m²</i>` : zn.id[0] === 'M' && zn.r ? zn.name : `${/^[0-9]/.test(zn.id) ? zn.id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>`;
    d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d);
  }
  for (let v = -250; v <= 250; v += 50) {
    const [px] = project(v, 0, size), [, pz] = project(0, v, size);
    for (const [l, t] of [[px, 5], [5 + 3, pz]]) { const d = document.createElement('div'); d.className = 'tick'; d.textContent = v; d.style.left = l + 'px'; d.style.top = t + 'px'; L.appendChild(d); }
  }
  for (const q of SECRETS) { const [px, pz] = project(q.x, q.z, size); const d = document.createElement('div'); d.className = 'tick'; d.style.color = q.k === 'b' ? '#fff' : q.k === 'c' ? '#1fd3e8' : '#ffc35a'; d.style.fontSize = '9px'; d.style.textShadow = '0 0 2px #000'; d.textContent = q.k === 'b' ? '★' : q.k === 'c' ? '◆' : '■'; d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d); }
  if (!budgetMode) for (const c of CHAIN) {
    if (typeof c.n !== 'number') continue;
    const [px, pz] = project(c.x, c.z, size); const d = document.createElement('div'); d.className = 'step'; d.textContent = c.n;
    d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d);
  }
}

function layoutCanvas(w, h, top) { renderer.setSize(w, h); renderer.domElement.style.top = top + 'px'; }
let current = null;
function render(cam) { if (cam === persp) persp.updateProjectionMatrix(); renderer.render(scene, cam); }

const VIEWS = {
  plan() {
    const W = VW(); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>SHOWCASE TEMPLATE · 500 m CELL · TOP-DOWN PLAN</b><span>Jake’s 11-02 ruling, north up: WEST = no enemies, EAST = combat in level bands. Navy grid = 50 m. Magenta = the 9-leg chain (west loop, then the east serpentine to the L20 boss). ★ vista · ◆ cache · ■ loot chest.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, false);
    const b = budget(), L = chainLength();
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>DOES IT FIT? Yes. West ${Math.round((b.west + b.cand) / 1250)} % used, east ${Math.round((b.band + b.set) / 1250)} % used (it is the combat map)</h3>
      <table><tr><td>West (x &lt; 0): hub, range, hover park, movers, grapple + zip, riding, cave hill, vault; no enemies. East: six level bands in a serpentine that ends in the far corner at the L20 boss. A seam wall and a walled east road keep enemies out of the west and off the east entry.</td></tr>
      <tr><td>Edges: four 8 m entries; the east entry lands on the walled road, never in a band. Sky: one clock and weather per cell, so storm hour turns the whole cell for leg 8.</td></tr>
      <tr><td>Under the cell (0 m² of surface): ${INTERIORS.map(i => `${i.name} ${i.w}×${i.d} m at y ${i.y}`).join(' · ')}.</td></tr>
      <tr><td>Chain ~${(L / 1000).toFixed(2)} km straight-line (≈${(L * 1.2 / 1000).toFixed(1)} km walked): ${Math.round(L * 1.2 / REAL.walk / 60)} min walking, ${Math.round(L * 1.2 / REAL.sprint / 60)} min sprinting, plus the fights.</td></tr></table>
      <h3>THE CHAIN: 9 LEGS, A CHECKPOINT CARD EACH</h3><table>${CHAIN.filter(c => typeof c.n === 'number').map(c => `<tr><td style="width:14px"><b>${c.n}</b></td><td>${c.label}</td></tr>`).join('')}</table>`;
    render(ortho);
  },
  budget() {
    const W = VW(); signs.visible = false; planOnly.visible = false; budgetOnly.visible = true;
    scene.fog = null; $('cap').innerHTML = '<b>SHOWCASE TEMPLATE · AREA BUDGET (used vs free)</b><span>Orange = west non-combat zones · teal = west support · yellow→red = east level bands 1–6 · maroon = combat set pieces · slate = roads, strip, wall · bare grid = free. Pink edge = 16 m look blend. White = 62.5 m render tiles.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, true);
    const b = budget(), pct = n => (n / 2500).toFixed(1) + ' %';
    const sw = c => `<span class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></span>`;
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>250,000 m² cell · 1 m raster of layout.js</h3><table>
      <tr><td>${sw(KIND.west)}West non-combat zones</td><td class="num">${fmt(b.west)} m²</td><td class="num">${pct(b.west)}</td></tr>
      <tr><td>${sw(KIND.cand)}West support (mount post, cave hill, vault)</td><td class="num">${fmt(b.cand)} m²</td><td class="num">${pct(b.cand)}</td></tr>
      <tr><td>${sw(KIND.band)}East level bands (spawns, crates, chests)</td><td class="num">${fmt(b.band)} m²</td><td class="num">${pct(b.band)}</td></tr>
      <tr><td>${sw(KIND.set)}East set pieces (stealth, gauntlet, 3 mini-bosses, boss, dungeon door)</td><td class="num">${fmt(b.set)} m²</td><td class="num">${pct(b.set)}</td></tr>
      <tr><td>${sw(0x3c4148)}Circulation: strip, avenues, ring, wall</td><td class="num">${fmt(b.circ)} m²</td><td class="num">${pct(b.circ)}</td></tr>
      <tr><td>${sw(0xc3c6c9)}<b>Free floor</b> (buffers, sightline breaks, room to grow)</td><td class="num"><b>${fmt(b.free)} m²</b></td><td class="num"><b>${pct(b.free)}</b></td></tr>
      <tr><td>Set pieces inside bands (counted once)</td><td class="num">${fmt(b.overlap)} m²</td><td></td></tr>
      <tr><td colspan="3"><h3>ZONES</h3>${ZONES.map(z => `${z.name.toLowerCase()} <b>${fmt(zoneArea(z))}</b>`).join(' · ')} m².</td></tr>
      <tr><td colspan="3">Stacked, 0 m² extra: vistas on the tower, cistern, hill and arena rim · zipline over the west · rope bridge park → cistern · plates in the hover park · trophy wall, feats, contracts, upgrades in the hub · checkpoint cards per leg · vault, mini dungeon and cave under the cell.</td></tr></table>`;
    render(ortho);
  },
  aerial() {
    full(); signScale(.55); persp.near = 2; persp.fov = 78; persp.position.set(0, 470, 540); persp.lookAt(0, 0, -45); persp.updateProjectionMatrix();
    caption('AERIAL · the whole 500 m cell from the south, 470 m up', 'Grey blockout, measured. Signs name each zone. The cell edge, its four entries and the road gap to the neighbours are real numbers.');
    render(persp);
  },
  hub() {
    full(); persp.fov = 64; persp.position.set(-22, EYE, 28); persp.lookAt(10, 5, -16);
    caption('GROUND VIEW · HUB · eye 1.7 m, looking north-east', 'From the south-west of the plaza. Finding: at eye height an 80 m plaza reads empty; the 30 m obelisk is all you see and the board, vendor and upgrade shop sit 20–30 m apart. Round 2: hub r 25–30.');
    render(persp);
  },
  dense() {
    full(); persp.fov = 66; persp.position.set(-88, EYE, -18); persp.lookAt(-140, 10, -48);
    caption('GROUND VIEW · WEST TRAVERSAL CLUSTER · eye 1.7 m', 'From the west avenue: the 18 m cistern and hook mast, the movers park climbing behind. The 45 m tower is off-frame left: in portrait at eye height you read one structure at a time.');
    render(persp);
  },
  band1() {
    full(); persp.fov = 64; persp.position.set(46, EYE, -16); persp.lookAt(110, 3, -40);
    caption('GROUND VIEW · EAST GATE INTO BAND 1 · eye 1.7 m', 'Out of the hub’s east gate: band 1 (L1–3) packs (red) at dark spawners, crates, the walled east road at bottom right. Finding: one pack per ~3,500 m² reads sparse at eye height; bands want cover and props between packs.');
    render(persp);
  },
  boss() {
    full(); persp.fov = 62; persp.position.set(120, EYE + .4, 190); persp.lookAt(198, 6, 190);
    caption('GROUND VIEW · L20 BOSS ARENA · eye 1.7 m, on the approach', 'The 39 × 16 m straight approach for the in-engine intro (cyan camera pads on the rim) into the r 28 floor (Driftwood’s r 22 + 6). Red = hazard ring and telegraph pads; the crate stack is the Titan.');
    render(persp);
  },
  edge() {
    full(); persp.fov = 62; persp.position.set(0, EYE, -292); persp.lookAt(0, 6, -150);
    caption('GROUND VIEW · FROM THE ROAD · north entry, eye 1.7 m', 'On the grid road, 42 m outside the cell. The 8 m entry and its apron; inside, the seam wall runs down the avenue: combat to the left (east), none to the right.');
    render(persp);
  },
};
function full() {
  layoutCanvas(VW(), VH(), 0); signs.visible = true; signScale(.8); persp.near = .3; planOnly.visible = false; budgetOnly.visible = false;
  scene.fog = new THREE.Fog(0xa9c4dc, 350, 1400); $('labels').innerHTML = ''; $('panel').hidden = true;
  persp.aspect = VW() / VH(); persp.updateProjectionMatrix();
}
function signScale(f) { for (const sp of signList) sp.scale.set(sp.userData.k[0] * f, sp.userData.k[1] * f, 1); }
function caption(title, text) {
  $('cap').innerHTML = `<b>${title}</b><span>${text}</span>`;
  $('foot').hidden = false; $('foot').textContent = 'Showcase Template · round 1 grey blockout · art/showcase-template/round-1-blockout · labels are burned in';
}

const ui = $('ui'); for (const k of [...Object.keys(VIEWS), 'orbit']) { const o = document.createElement('option'); o.textContent = k; ui.appendChild(o); }
ui.onchange = () => show(ui.value);
function show(name) {
  current = name; controls.enabled = name === 'orbit';
  if (name === 'orbit') { full(); caption('ORBIT · drag to look around', ''); persp.position.set(0, 220, 380); controls.target.set(0, 0, 0); controls.update(); return; }
  VIEWS[name]();
}
renderer.setAnimationLoop(() => { if (current === 'orbit') { controls.update(); render(persp); } });
const params = new URLSearchParams(location.search);  // capture.mjs passes no params; the page opens on the plan
show(params.has('v') ? params.get('v') : 'plan');
window.lab = { show: n => { ui.value = n; show(n); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, budget, chainLength };
window.labReady = true;
