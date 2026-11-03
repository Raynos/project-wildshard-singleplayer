// Showcase Template grey blockout lab, ROUND 2: builds the measured layout in layout.js as dev-map blocks and frames the
// captures (plan board, budget board, aerial, ground views at 1.7 m eye height). window.lab.show(name) for capture.mjs.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REAL, HALF, STRIP, RING, AVENUE_HALF, ZONES, INTERIORS, SECRETS, HUB, HUB_R, BEACONS, BANDS, GATE_ELITES, ELITES,
  ELITE_LAIR_R, LOOKOUT, GOLD, GRIND, VARIANTS, CONTRACTS } from './layout.js';
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

function buildStealth() {
  flatRect(125, 225, 108, 212, 0.04, M.light);
  const wall = (x0, z0, x1, z1) => box(Math.max(.6, Math.abs(x1 - x0)), 2.6, Math.max(.6, Math.abs(z1 - z0)), (x0 + x1) / 2, 0, (z0 + z1) / 2, M.orange);
  wall(125, 108, 145, 108); wall(155, 108, 225, 108); wall(225, 108, 225, 212); wall(145, 212, 225, 212); wall(125, 108, 125, 195);   // gates N (x 150) + SW
  for (let i = 0; i < 6; i++) box(2, 2.2, 24, 134 + (i % 3) * 9, 0, 125 + Math.floor(i / 3) * 44 + (i % 2) * 8, M.grey);                 // tall cover walls
  box(8, 4, 6, 212, 0, 200, M.orangeDark); sign('KEYCARD', '', 212, 8, 200, 10);
  sign('07 STEALTH YARD', 'band 5 · Riveter patrols · storm cover', 175, 14, 160, 34);
  sign('TALL COVER', '', 142, 6, 160, 12);
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

function buildHill() {
  add(new THREE.CylinderGeometry(20, 49, 16, 4), M.grey, -180, 8, -180, { ry: Math.PI / 4, edges: true });
  box(3, .6, 1, -180, 16, -180, M.orangeDark); box(5, 3.5, 1, -180, 0, -145.8, M.dark, { edges: false }); box(1, 5, 4, -145.5, 0, -180, M.portal, { edges: false });
  for (let i = 0; i < 7; i++) box(4, 2.2 * (i + 1) * .33, 3, -170 + i * 3, 0, -146 + (i % 2), M.grey);   // scramble steps
  box(.4, 16, .6, -205, 0, -152, M.dark);   // ladder
  sign('CAVE HILL', 'climb · vista · cave + squeeze', -180, 26, -180, 28);
}


// ---------- round 2 builders ----------
const P = placeContent();
const fmt = n => Math.round(n).toLocaleString('en-US');
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
const faceIn = (x, z) => -Math.atan2(z, x) - Math.PI / 2;   // a box's long side tangent to the hub, facing the centre

function bang(x, y, z, yellow) {   // a quest "!" over a giver: yellow when a level-1 player may take it, grey when locked
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  g.font = 'bold 86px Helvetica'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = '#222'; g.strokeText('!', 32, 82);
  g.fillStyle = yellow ? '#ffd23a' : '#9a9a9a'; g.fillText('!', 32, 82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); s.scale.set(1, 1.5, 1); s.position.set(x, y, z); target.add(s);
}
function buildHub() {
  flatDisc(0, 0, HUB_R, 0.04, M.light);
  box(3, 1.2, 3, 18, 0, -18, M.grey); add(new THREE.CylinderGeometry(.35, .9, 12, 4), M.orange, 18, 7.2, -18, { ry: Math.PI / 4, edges: true });  // obelisk, off-centre: in the middle it hid the stalls
  for (const s of HUB.services) {
    const ry = faceIn(s.x, s.z);
    if (s.id === 'QB' || s.id === 'CB' || s.id === 'FT') box(s.id === 'FT' ? 4 : 6, 3.2, .5, s.x, 0, s.z, s.id === 'QB' ? M.orange : M.orangeDark, { ry });
    if (s.id === 'VN') { box(6, 2.8, 4, s.x, 0, s.z, M.grey, { ry }); box(7, .35, 5, s.x, 2.8, s.z, M.orange, { ry }); }
    if (s.id === 'UP') { box(6, 3.2, 4.5, s.x, 0, s.z, M.grey, { ry }); box(7, .35, 5.5, s.x, 3.2, s.z, M.cyan, { ry }); }
    if (s.id === 'TW') { box(10, 4, .6, s.x, 0, s.z, M.orange, { ry }); }
    sign(s.name, '', s.x, s.id === 'TW' ? 6 : 5.4, s.z, 8);
  }
  { // trophy wall: 12 frames, 6 x 2, on the wall's inner face
    const tw = HUB.services.find(s => s.id === 'TW'), ry = faceIn(tw.x, tw.z), n = [-tw.x, -tw.z].map(v => v / Math.hypot(tw.x, tw.z));
    const tx = Math.cos(ry), tz = -Math.sin(ry);
    for (let i = 0; i < 12; i++) { const u = -3.75 + (i % 6) * 1.5, v = i < 6 ? 2.9 : 1.5; box(1.1, 1.1, .15, tw.x + tx * u + n[0] * .4, v - .55, tw.z + tz * u + n[1] * .4, i < 9 ? M.white : M.grey, { ry, shadow: false }); }
  }
  for (const n of HUB.npcs) {
    capsule(n.x, n.z, 1.8, .4, n.giver ? M.grey : M.cyan);
    if (n.giver) bang(n.x, 3.1, n.z, n.lock.startsWith('L1'));
    sign(n.name.toUpperCase(), n.lock, n.x, n.giver ? 4.4 : 3.2, n.z, 8);
  }
  for (let a = 0; a < 4; a++) for (const s of [-1, 1]) { const ang = a * Math.PI / 2, x = Math.cos(ang) * 38, z = Math.sin(ang) * 38, px = -Math.sin(ang) * 7 * s, pz = Math.cos(ang) * 7 * s; box(1.6, 5, 1.6, x + px, 0, z + pz, M.orangeDark); }
  sign('01 HUB', '⌀56 m · board, contracts, shop, trophies', 0, 22, 0, 30);
}

function buildMovers() {   // the park only (round 1's route), now on stilts so it reads as one rising staircase
  flatRect(112, 190, -108, -28, 0.04, M.light);
  const route = [[125, -40, 1], [135, -50, 2.5], [128, -64, 4], [138, -76, 5.5], [152, -82, 7], [166, -74, 8.5], [176, -62, 10], [172, -48, 11.5], [182, -40, 13], [186, -54, 14.5], [186, -70, 16], [192, -78, 17.5]];
  route.forEach(([x, zz, y], i) => { box(6, 1, 6, x, y - 1, zz, i % 3 === 1 ? M.cyan : M.orange); if (y > 2) box(.6, y - 1, .6, x, 0, zz, M.dark); });
  for (const [x, zz] of [[150, -45], [160, -95]]) { box(6, .6, 6, x, 6, zz, M.orange); box(.4, 14, .4, x - 3.2, 0, zz, M.dark); box(.4, 14, .4, x + 3.2, 0, zz, M.dark); }
  for (const [x, zz] of [[120, -90], [142, -100]]) { cyl(4, 4, .6, x, 2, zz, M.orange); box(8, .6, .8, x, 2.6, zz, M.dark); cyl(.4, .4, 2, x, 0, zz, M.dark); }
  box(30, .6, 3, 150, 0, -35, M.dark); box(3, .6, 24, 118, 0, -66, M.dark);
  for (const [x, zz] of [[135, -32], [165, -32], [120, -50], [178, -98]]) cyl(1.5, 1.5, .4, x, 0, zz, M.cyan);
  box(8, .8, 4, 170, 4, -100, M.orange);
  sign('05 MOVERS PARK', 'a staircase climbing 0 → 18 m', 151, 24, -68, 30);
}
function buildHopChain() {   // R2 silhouettes: a white round tank, a single mast, an open lattice tower (world coords)
  cyl(16, 16, 18, -131, 0, -75, M.tank, { seg: 32 }); cyl(16.3, 16.3, 1.2, -131, 16.8, -75, M.orange, { seg: 32 });
  box(.6, 18, .3, -147.3, 0, -75, M.dark);
  cable(sag([-151, 16.4, -78], [-147, 18.1, -77], 1), 0x6b4a2a, .25);
  sign('WATER TANK', '18 m · roof vista · hook 1', -131, 26, -75, 22);
  box(1.4, 28, 1.4, -131, 0, -22, M.dark); add(new THREE.SphereGeometry(1.4, 12, 8), M.cyan, -131, 28.6, -22);
  sign('HOOK MAST', '28 m', -131, 33, -22, 12);
  const tx = -132, tz = 23;
  for (const [dx, dz] of [[-7, -7], [7, -7], [7, 7], [-7, 7]]) box(1.2, 45, 1.2, tx + dx, 0, tz + dz, M.orange);
  for (let y = 9; y < 45; y += 9) box(16, .6, 16, tx, y, tz, M.orangeDark);
  box(5, 3, 5, tx, 45, tz, M.cyan);
  cable(sag([tx, 45, tz], [-60, 2.5, -102], 7, 20));
  sign('06 GRAPPLE TOWER', '45 m lattice · zip 146 m', tx, 54, tz, 30);
  box(2.4, .5, .7, LOOKOUT.x, 0, LOOKOUT.z, M.white); sign('LOOKOUT', 'the hop chain in one frame', LOOKOUT.x, 4, LOOKOUT.z, 14);
}
function buildMountPost() {
  box(10, 4, 6, -60, 0, -104, M.grey); for (let i = 0; i < 2; i++) box(2.4, 1.5, .7, -66 + i * 12, 0, -96, M.grey);
  capsule(HUB.stableHand.x, HUB.stableHand.z, 1.8, .4, M.cyan);
  sign('MOUNT POST', 'stable hand · loaner horse', -60, 9, -102, 16);
}
function buildGauntlet() {
  const g = ZONES.find(z => z.id === '08');
  flatDisc(g.x, g.z, 28, 0.05, M.dirt);
  ringWall(g.x, g.z, [[28, 0], [28, 1.2], [32, 1.2], [32, 2.4], [36, 2.4], [36, 0]], M.orange, [[Math.PI / 2, .3], [-.6, .3]]);
  capsule(g.x, g.z, 3.4, .9, M.elite);
  sign('08 GAUNTLET', 'waves · elite FOREMAN UNIT 7 · L18', g.x, 16, g.z, 32);
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
function buildEast() {
  for (const zn of ZONES.filter(q => q.kind === 'band')) {
    for (const [x0, x1, z0, z1] of zn.shape === 'rects' ? zn.list : [[zn.x0, zn.x1, zn.z0, zn.z1]]) flatRect(x0, x1, z0, z1, 0.02, mat(BAND_TINT[zn.band - 1]));
    const B = BANDS.find(b => b.band === zn.band), [cx, cz] = zoneCentre(zn);
    sign(zn.name, `${B.enemy} · ${B.role}`, cx, 14, cz + (zn.band === 1 ? 30 : zn.band === 6 ? 70 : 0), 30);
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
    capsule(l.x, l.z, 2.6, .7, M.elite); sign(l.name.toUpperCase(), `night elite L${l.lv} · proposed`, l.x, 6, l.z, 16);
  }
  for (const c of P.chests) box(1.4, 1, .9, c.x, 0, c.z, M.glow);
  for (const c of P.crates) { box(1, 1, 1, c.x, 0, c.z, M.orangeDark); box(1.02, .2, 1.02, c.x, .4, c.z, M.cyan, { edges: false }); }
  for (const b of BEACONS) { box(4, 2, 4, b.x, 0, b.z, M.grey); box(1.4, 16, 1.4, b.x, 2, b.z, M.dark); box(2.6, 2, 2.6, b.x, 18, b.z, M.glow); sign(`BEACON ${b.n}`, 'storm hour', b.x, 24, b.z, 12); }
  // seam wall and the walled east road (gates at band 1 and the band 4 → 5 crossing)
  for (const s of [-1, 1]) box(1, 3, 199, 7.5, 0, s * 137.5, M.orange);
  for (const s of [-1, 1]) for (const [a, b] of [[40, 75], [96, 169], [184, 237]]) box(b - a, 3, 1, (a + b) / 2, 0, s * 8.5, M.orange);
  for (const x of [75, 96, 169, 184]) for (const s of [-1, 1]) box(1.6, 5, 1.6, x, 0, s * 8.5, M.orangeDark);
  const bp = GATE_ELITES[0];
  flatDisc(bp.x, bp.z, 12, 0.05, M.dirt); ringWall(bp.x, bp.z, [[12, 0], [12, 1.4], [14, 1.4], [14, 0]], M.orangeDark, [[Math.PI / 2, .5], [-Math.PI / 2, .5]]);
  capsule(bp.x, bp.z, 3.6, 1, M.elite); sign('BIG PALLET', 'band-gate elite · L6', bp.x, 9, bp.z, 16);
}
function buildSecrets() {
  for (const q of SECRETS) q.k === 'b' ? box(2, .5, .7, q.x, q.y, q.z + 2, M.white) : box(.9, .9, .9, q.x, q.y, q.z, M.cyan);
  for (const g of GOLD) box(1, 1, 1, g.x, g.y, g.z, M.gold);
  sign('PERIMETER STRIP', 'the safe ring road', -120, 6, 242, 26);
}
buildGround(); buildHub();
place(buildRange, -110, 0, Math.PI);
place(buildRiding, -260, 0);
place(buildMovers, -344, 0);
buildHopChain(); buildMountPost();
place(buildStealth, 5, -78);
buildGauntlet();
place(buildArena, 243, 350, -Math.PI / 2);
place(buildHover, 0, 216);
place(buildHill, -20, 252);
buildVault(); buildEast(); buildSecrets();

// ---------- plan overlays ----------
const planOnly = new THREE.Group(), budgetOnly = new THREE.Group(); scene.add(planOnly, budgetOnly);
function lineGrid(step, color, opacity, group, y = 60, x0 = -HALF, x1 = HALF) {
  const pts = []; for (let v = -HALF; v <= HALF + .01; v += step) { pts.push(v, y, -HALF, v, y, HALF, -HALF, y, v, HALF, y, v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false })); l.renderOrder = 9; group.add(l);
  void x0; void x1;
}
lineGrid(50, 0x0b2a52, .55, planOnly);
{ // the vault's four rooms, dashed, under band 4
  const I = INTERIORS[0], m = new THREE.LineDashedMaterial({ color: 0x1238c8, dashSize: 3, gapSize: 2, depthTest: false });
  const sq = (x, z, w, d) => { const g = new THREE.BufferGeometry().setFromPoints([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2], [x - w / 2, z - d / 2]].map(([a, b]) => new THREE.Vector3(a, 61, b))); const l = new THREE.Line(g, m); l.computeLineDistances(); l.renderOrder = 11; planOnly.add(l); };
  sq(I.cx, I.cz, I.w, I.d);
  I.rooms.forEach(([, w, d], i) => sq(I.cx + (i % 2 ? 17 : -17), I.cz + (i < 2 ? -17 : 17), w, d));
}
const KIND = { west: 0xe2782c, cand: 0x1fa7b8, set: 0x7d1d2c, band: 0xc9604f };
for (const zn of ZONES) {
  const m = new THREE.MeshBasicMaterial({ color: zn.kind === 'band' ? BAND_TINT[zn.band - 1] : KIND[zn.kind], transparent: true, opacity: zn.kind === 'band' ? .92 : .85, depthTest: false });
  if (zn.kind === 'band') m.color.offsetHSL(0, .25, -.18);
  const put = g => { g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; return mesh; };
  if (zn.shape === 'rect') { const mesh = put(new THREE.PlaneGeometry(zn.x1 - zn.x0, zn.z1 - zn.z0)); mesh.position.set((zn.x0 + zn.x1) / 2, zn.kind === 'band' ? 58.5 : 59, (zn.z0 + zn.z1) / 2); if (zn.kind === 'band') mesh.renderOrder = 5.5; budgetOnly.add(mesh); }
  if (zn.shape === 'disc') { const mesh = put(new THREE.CircleGeometry(zn.r, 64)); mesh.position.set(zn.x, 59, zn.z); budgetOnly.add(mesh); }
  if (zn.shape === 'stadium') { const g = new THREE.ShapeGeometry(stadiumShape(zn.x, zn.z, zn.halfLen, zn.r), 8); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.y = 59; mesh.renderOrder = 6; budgetOnly.add(mesh); }
  if (zn.shape === 'rects') for (const [x0, x1, z0, z1] of zn.list) { const mesh = put(new THREE.PlaneGeometry(x1 - x0, z1 - z0)); mesh.position.set((x0 + x1) / 2, 58.5, (z0 + z1) / 2); mesh.renderOrder = 5.5; budgetOnly.add(mesh); }
}
{
  const cm = new THREE.MeshBasicMaterial({ color: 0x3c4148, transparent: true, opacity: .75, depthTest: false });
  const rect = (x0, x1, z0, z1, m, y = 58) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); mesh.renderOrder = 5; budgetOnly.add(mesh); };
  rect(-250, 250, -250, -STRIP.inner, cm); rect(-250, 250, STRIP.inner, 250, cm); rect(-250, -STRIP.inner, -STRIP.inner, STRIP.inner, cm); rect(STRIP.inner, 250, -STRIP.inner, STRIP.inner, cm);
  rect(-AVENUE_HALF, AVENUE_HALF, -STRIP.inner, -RING.outer, cm); rect(-AVENUE_HALF, AVENUE_HALF, RING.outer, STRIP.inner, cm); rect(-STRIP.inner, -RING.outer, -AVENUE_HALF, AVENUE_HALF, cm); rect(RING.outer, STRIP.inner, -AVENUE_HALF, AVENUE_HALF, cm);
  const g = new THREE.RingGeometry(RING.inner, RING.outer, 64); g.rotateX(-Math.PI / 2); const ring = new THREE.Mesh(g, cm); ring.position.y = 58; ring.renderOrder = 5; budgetOnly.add(ring);
  const band = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: .22, depthTest: false });
  const e = HALF - REAL.edgeBand; rect(-250, 250, -250, -e, band, 61); rect(-250, 250, e, 250, band, 61); rect(-250, -e, -e, e, band, 61); rect(e, 250, -e, e, band, 61);
  lineGrid(REAL.l0Tile, 0xffffff, .45, budgetOnly, 62);
}
const placeOnly = new THREE.Group(); scene.add(placeOnly);
{ // placement map: each pack's aware circle (dashed band colour) so spacing is visible
  for (const p of P.packs) {
    const B = BANDS.find(b => b.band === p.band), g = new THREE.RingGeometry(B.aware - .6, B.aware, 40); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: p.night ? 0x1a2a7a : 0x8a1020, transparent: true, opacity: .8, depthTest: false })); m.position.set(p.x, 62, p.z); m.renderOrder = 12; placeOnly.add(m);
  }
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
function planLabels(size, top, mode) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  const off = { '01': [0, 0], 'C': [0, -26], '05': [0, 14], '06': [0, -16], 'K': [-50, -14], '09': [0, 14], '08': [0, 0], '11': [0, -16], 'B1': [0, 34], 'B6': [-10, -12], 'B4': [-10, -40], 'B5': [0, 26], 'B2': [20, 10], 'M6': [0, 18], 'TV': [-10, 18], 'MP': [0, 12], 'H': [0, -10] };
  if (mode !== 'place') for (const zn of ZONES) {
    if (mode === 'budget' && zn.id === '01') continue;
    const [cx, cz] = zoneCentre(zn), [ox, oz] = off[zn.id] ?? [0, 0];
    const [px, pz] = project(cx + ox, cz + oz, size);
    const d = document.createElement('div'); d.className = 'lb ' + (zn.kind === 'cand' ? 'cand' : '');
    d.innerHTML = zn.kind === 'band' ? `${zn.name}<i>${fmt(zoneArea(zn))} m²</i>` : zn.id === 'M6' ? zn.name : `${/^[0-9]/.test(zn.id) ? zn.id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>`;
    d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d);
  }
  if (mode !== 'place') for (let v = -250; v <= 250; v += 50) { mark(L, v, -256, size, v, '#e9e9e9', 6.5); mark(L, -255, v, size, v, '#e9e9e9', 6.5); }
  if (mode === 'budget') return;
  for (const q of SECRETS) mark(L, q.x, q.z, size, q.k === 'b' ? '★' : '◆', q.k === 'b' ? '#fff' : '#1fd3e8');
  for (const b of BEACONS) mark(L, b.x, b.z, size, `✦${b.n}`, '#ffd23a', mode === 'place' ? 13 : 10);
  for (const q of P.quests) mark(L, q.x, q.z, size, mode === 'place' ? `!<span style="font-size:8px">L${q.lock}</span>` : '!', '#ffe14a', mode === 'place' ? 13 : 11);
  if (mode === 'place') {
    for (const p of P.packs) mark(L, p.x, p.z - 9, size, (p.night ? '☾' : '') + 'Mk' + 'I'.repeat(p.tier + 1), p.night ? '#9fb4ff' : '#ffffff', 8);
    for (const l of P.lairs) mark(L, l.x, l.z, size, `◆ ${l.name}<br><span style="font-size:7px">night elite L${l.lv} (proposed)</span>`, '#e09bff', 9);
    for (const e of GATE_ELITES) mark(L, e.x, e.z + (e.lv === 18 ? 0 : e.lv === 20 ? 0 : 0), size, `◆ ${e.name}<br><span style="font-size:7px">${e.lv === 20 ? 'boss' : 'band-gate elite'} L${e.lv}</span>`, '#e09bff', 9);
    for (const c of P.chests) mark(L, c.x, c.z, size, '■', '#ffc35a', 10);
    for (const c of P.crates) mark(L, c.x, c.z, size, '▪', '#3fe0ee', 9);
    for (const g of GOLD) mark(L, g.x, g.z, size, '●', '#ffd000', 10);
    for (const b of BANDS) { const zn = ZONES.find(z => z.band === b.band), [cx, cz] = zoneCentre(zn); mark(L, cx + (b.band === 6 ? 0 : 0), cz + (b.band === 6 ? 80 : b.band === 1 ? 44 : b.band === 5 ? -40 : 0) - (b.band === 4 ? 40 : 0), size, `B${b.band} · ${b.enemy} L${b.lv[0]}–${b.lv[2]}`, '#ffffff', 10); }
  } else for (const g of GOLD) mark(L, g.x, g.z, size, '●', '#ffd000', 8);
}
function layoutCanvas(w, h, top) { renderer.setSize(w, h); renderer.domElement.style.top = top + 'px'; }
let current = null;
function render(cam) { if (cam === persp) persp.updateProjectionMatrix(); renderer.render(scene, cam); }
const B_ = budget(), G_ = grind(P), S_ = onScreen(P), R2_ = coverReach(P), R1_ = coverReach(P, false);
const sw = c => `<span class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></span>`;
const hubSpan = (() => { let m = 0; for (const a of HUB.services) for (const b of HUB.services) m = Math.max(m, Math.hypot(a.x - b.x, a.z - b.z)); return m; })();
function hubSvg() {
  const k = 2.1, c = 64, el = [`<svg width="130" height="130" viewBox="0 0 130 130"><circle cx="${c}" cy="${c}" r="${38 * k * .8}" fill="#3c4148"/><circle cx="${c}" cy="${c}" r="${HUB_R * k * .8}" fill="#dcdedf"/>`];
  const P2 = (x, z) => [c + x * k * .8, c + z * k * .8];
  for (const s of HUB.services) { const [x, y] = P2(s.x, s.z); el.push(`<rect x="${x - 5}" y="${y - 3}" width="10" height="6" fill="#e2782c"/><text x="${x}" y="${y + 9}" font-size="6.2" text-anchor="middle" fill="#111" font-weight="700">${s.name.replace('QUEST ', '')}</text>`); }
  for (const n of HUB.npcs) { const [x, y] = P2(n.x, n.z); el.push(`<circle cx="${x}" cy="${y}" r="3" fill="${n.giver ? '#ffd23a' : '#1fd3e8'}" stroke="#111"/><text x="${x}" y="${y - 4.5}" font-size="6" text-anchor="middle" fill="#111" font-weight="700">${n.id}</text>`); }
  el.push(`<text x="4" y="126" font-size="7" fill="#fff">hub r ${HUB_R} m · services ≤ ${Math.round(hubSpan)} m apart</text></svg>`);
  return el.join('');
}
const VIEWS = {
  plan() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 2 · 500 m CELL · TOP-DOWN PLAN</b><span>North up. WEST = no enemies; EAST = six level bands. No fixed chain: quests are freeform and level-locked. ! quest target · ✦ storm beacon · ★ vista · ◆ cache · ● Gold 1×1 · blue dashes = Training Vault rooms at y −40.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'plan');
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>IT FITS: west ${Math.round((B_.west + B_.cand) / 1250)} % used, east ${Math.round((B_.band + B_.set) / 1250)} % · ${P.packs.length} packs, ${S_.total} enemies, 6 elites + the Titan</h3>
      <table><tr><td style="width:132px">${hubSvg()}</td><td>
      <b>Hub NPCs</b> (yellow ! = open to a level 1, grey = locked): ${HUB.npcs.map(n => `<b>${n.id} ${n.name}</b> ${n.lock}: ${n.quests}`).join('. ')}. The stable hand is at the mount post.<br>
      <b>Storm beacons ✦</b> on band 5's corners, outside the stealth-yard walls: storm hour is the L13 quest and the storm is the yard's cover, so the beacons sit in the band that quest is for; at the cell corners two would be in the west (no enemies, no stakes) and one beside the Titan (L20); 108–124 m apart, each in sight of the next.</td></tr></table>
      <b>Elites</b>: Big Pallet L6 (pit, band 2) · Vault Warden L12 (room 4 of the Training Vault, portal in band 4) · Foreman Unit 7 L18 (gauntlet finale, band 6) · night elites ${ELITES.map(e => `${e.name} L${e.lv} (band ${e.band})`).join(', ')}, proposed · the Crate Titan L20 far south-east.`;
    ortho.layers.enableAll(); render(ortho);
  },
  place2() { VIEWS.place(true); },
  place(south) {
    const W = VW(); if (south) setFrame(-2, 250, -2, 250); else setFrame(-2, 250, -250, 2); signs.visible = false; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = true;
    scene.fog = null; $('cap').innerHTML = `<b>ROUND 2 · CONTENT PLACEMENT · ${south ? 'SOUTH-EAST (bands 1, 5, 6, the Titan)' : 'NORTH-EAST (bands 1–4)'}</b><span>Every pack (rings = its aware radius; dark blue = swaps to night shift after dark), Mk I–III = its level in the band, ◆ elites, ■ loot chest, ▪ loot crate, ● Gold 1×1, ! quest target and its lock, ✦ storm beacon. Grey blocks = cover.</span>`;
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'place');
    $('panel').hidden = false; $('foot').hidden = true;
    const F = P.fit;
    $('panel').innerHTML = `<h3>DOES THE CONTENT FIT? Yes, after three fixes (spacing = aware + leash + 3 m; behind a 3 m wall, leash + 3)</h3><table>
      <tr><td><b>Band</b></td><td><b>Common</b></td><td class="num"><b>Space</b></td><td class="num"><b>Slots</b></td><td class="num"><b>Packs</b></td><td class="num"><b>Pool/Mk</b></td><td class="num"><b>Back</b></td><td class="num"><b>Min</b></td></tr>
      ${F.map((f, i) => `<tr><td>${f.band}</td><td>${f.enemy} ×${BANDS[i].packSize}</td><td class="num">${f.spacing} m</td><td class="num">${f.capacity}/${f.need}</td><td class="num">${f.placed}</td><td class="num">${G_[i].pool}</td><td class="num">${G_[i].loopBackS} s</td><td class="num">${G_[i].minutes}</td></tr>`).join('')}</table>
      Slots = lattice capacity / packs + lair needed. Back = from leaving a Mk's first pack to returning to it (≥ 90 s respawn: no band waits). Min = minutes to level through the band at 2.5 kills/min (${G_.reduce((a, g) => a + g.minutes, 0)} min in all).<br>
      <b>Phone</b>: ${S_.total} commons by day; at most ${S_.view} in a portrait view (33°, 100 m), ${S_.awake60} within 60 m, ${S_.near150} inside the 150 m near radius.<br>
      <b>Cover</b>: ${P.cover.length} pieces; floor to nearest cover p95 ${R2_.p95} m (round 1's crates-by-packs rule: ${R1_.p95} m).`;
    render(ortho);
  },
  budget() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = false; budgetOnly.visible = true; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 2 · AREA BUDGET (used vs free)</b><span>Orange = west non-combat · teal = west support · yellow→red = level bands 1–6 · maroon = combat set pieces · slate = roads, strip, wall · bare grid = free. Pink = 16 m edge blend. White = 62.5 m render tiles.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'budget');
    const pct = n => (n / 2500).toFixed(1) + ' %';
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>250,000 m² cell · 1 m raster of layout.js · round 1 in brackets</h3><table>
      <tr><td>${sw(KIND.west)}West non-combat zones</td><td class="num">${fmt(B_.west)} m²</td><td class="num">${pct(B_.west)}</td><td class="num">(20.2 %)</td></tr>
      <tr><td>${sw(KIND.cand)}West support (mount post, cave hill)</td><td class="num">${fmt(B_.cand)} m²</td><td class="num">${pct(B_.cand)}</td><td class="num">(3.2 %)</td></tr>
      <tr><td>${sw(KIND.band)}East level bands</td><td class="num">${fmt(B_.band)} m²</td><td class="num">${pct(B_.band)}</td><td class="num">(29.8 %)</td></tr>
      <tr><td>${sw(KIND.set)}East set pieces (yard, gauntlet, Big Pallet pit, vault, Titan)</td><td class="num">${fmt(B_.set)} m²</td><td class="num">${pct(B_.set)}</td><td class="num">(9.3 %)</td></tr>
      <tr><td>${sw(0x3c4148)}Roads, strip, ring, wall</td><td class="num">${fmt(B_.circ)} m²</td><td class="num">${pct(B_.circ)}</td><td class="num">(14.7 %)</td></tr>
      <tr><td>${sw(0xc3c6c9)}<b>Free floor</b></td><td class="num"><b>${fmt(B_.free)} m²</b></td><td class="num"><b>${pct(B_.free)}</b></td><td class="num">(22.7 %)</td></tr>
      <tr><td colspan="4"><h3>ZONES</h3>${ZONES.map(z => `${z.name.toLowerCase()} <b>${fmt(zoneArea(z))}</b>`).join(' · ')} m².</td></tr>
      <tr><td colspan="4">0 m² extra: the Training Vault's 4 rooms (${INTERIORS[0].w}×${INTERIORS[0].d} m at y −40) and the cave under the cell · night shift on day spawn points · rare variants as a roll · vistas, Gold 1×1s, chests on structures and cover.</td></tr></table>`;
    render(ortho);
  },
  aerial() { full(); signScale(.55); for (const sp of packSigns) sp.visible = false; persp.near = 2; persp.fov = 78; persp.position.set(0, 470, 540); persp.lookAt(0, 0, -45); persp.updateProjectionMatrix(); caption('AERIAL · round 2 · the whole cell from the south, 470 m up', 'Hub r 28; the round 1 vault is gone (free ground west of the hub); cover fills every band; the Training Vault gatehouse sits in band 4.'); render(persp); },
  hub() { full(); persp.fov = 90; persp.position.set(-9, EYE, 21); persp.lookAt(3, 2.4, -16); signsWithin(48); caption('GROUND VIEW · HUB · eye 1.7 m, from the south', `Round 2's r 28 hub: quest board, contracts, vendor, upgrades and the trophy wall within ${Math.round(hubSpan)} m of each other (≈${Math.round(hubSpan / REAL.walk)} s walking). Yellow ! = a giver a level 1 can take; grey = locked.`); render(persp); },
  west() { full(); persp.fov = 66; persp.position.set(LOOKOUT.x, EYE, LOOKOUT.z); persp.lookAt(-130, 17, -18); signsWithin(200); caption('GROUND VIEW · WEST HOP CHAIN · from the lookout', 'From the bench on the old vault ground: the white round tank (18 m), the single hook mast (28 m) and the open 45 m lattice tower read as three shapes in one portrait frame; the zipline runs off to the mount post.'); render(persp); },
  b1() { band(1, [70, -16], [96, -44], 'Out of the band 1 road gate: Crate Mites in threes among crate stacks; a crate stack every ~12 m, so no open run is longer than a sprint second or two.'); },
  b2() { band(2, [40, -66], [72, -118], 'Pallet Jacks charge in straight lines and stun themselves on walls: grey walls are the cover, and a 12 m wall stands between every two packs closer than 40 m.'); },
  b3() { band(3, [60, -168], [110, -205], 'Plumb Drones hover at 3 m and kite at 12 m: scaffold frames with 6 m screens break their sight, so packs sit 33 m apart.'); },
  b4() { band(4, [150, -150], [175, -100], 'Welder Units in three-walled bays with slag pools; the Training Vault gatehouse is at the band\'s south end.'); },
  b5() { band(5, [126, 16], [180, 70], 'Band 5 is the stealth yard: Riveter patrol pairs with 15 m cones behind 2.6–3.2 m walls; a storm beacon on the band corner.'); },
  b6() { band(6, [96, 228], [40, 180], 'Arc Sentries in pairs among half-height L-covers. The one open band: no sight walls, so packs sit 40 m apart.'); },
  vault() {
    full(); persp.fov = 66;
    const door = [208.5, -61], segD = (c, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((c.x - a[0]) * dx + (c.z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(a[0] + t * dx - c.x, a[1] + t * dz - c.z); };
    let cam = [180, -61];
    search: for (const r of [28, 34, 40, 22]) for (let k = 0; k <= 12; k++) for (const sgn of [1, -1]) {
      const a = Math.PI + sgn * k * .08, c = [door[0] + Math.cos(a) * r, door[1] + Math.sin(a) * r];
      if (Math.abs(c[1]) < 10 || P.cover.some(q => Math.hypot(q.x - c[0], q.z - c[1]) < 6) || P.cover.some(q => segD(q, c, door) < 5)) continue;
      cam = c; break search;
    }
    persp.position.set(cam[0], EYE, cam[1]); persp.lookAt(door[0], 4, door[1]); signsWithin(90); caption('GROUND VIEW · TRAINING VAULT ENTRANCE · band 4', 'The portal gatehouse with its plate: 4 ROOMS · ELITE · ~10 MIN. The rooms (puzzle, fight, climb, Vault Warden L12) sit 40 m under the cell; Welder bays around the door.'); render(persp); },
  boss() { full(); persp.fov = 62; persp.position.set(120, EYE + .4, 190); persp.lookAt(198, 6, 190); signsWithin(140); caption('GROUND VIEW · CRATE TITAN L20 · on the approach', 'Unchanged from round 1: the 39 × 16 m approach for the in-engine intro (cyan camera pads) into the r 28 floor in the far south-east.'); render(persp); },
  compare() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 1 → ROUND 2 · same scale, north up</b><span>Top: round 1 (8094bf351f). Bottom: round 2. Vault merged into band 4 · chain gone · hub r 40 → 28 · cover in every band · L12/L18 pits folded into vault and gauntlet · beacons on band 5.</span>';
    const top = $('cap').offsetHeight, s = Math.min(W, Math.floor((VH() - top) / 2));
    const r1 = $('r1'); r1.hidden = false; Object.assign(r1.style, { top: top + 'px', width: s + 'px', height: s + 'px', left: (W - s) / 2 + 'px', backgroundSize: `${s}px ${s * 874 / 402}px`, backgroundPosition: `0 -${s * 77 / 402}px` });
    layoutCanvas(s, s, top + s); renderer.domElement.style.left = (W - s) / 2 + 'px'; planLabels(s, top + s, 'plan'); $('labels').style.left = (W - s) / 2 + 'px';
    $('panel').hidden = true; $('foot').hidden = true;
    for (const [id, y, t] of [['t1', top + 4, 'ROUND 1'], ['t2', top + s + 4, 'ROUND 2']]) { const d = $(id); d.hidden = false; d.textContent = t; d.style.top = y + 'px'; }
    render(ortho);
  },
};
function clearShot(n) {
  const mine = P.packs.filter(p => p.band === n), cv = P.cover;
  const order = [...mine.filter(p => p.tier === 1), ...mine.filter(p => p.night), ...mine];
  const segD = (c, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((c.x - a[0]) * dx + (c.z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(a[0] + t * dx - c.x, a[1] + t * dz - c.z); };
  for (const p of order) for (let h = 0; h < 24; h++) {
    const a = h / 24 * Math.PI * 2, cam = [p.x + Math.cos(a) * 20, p.z + Math.sin(a) * 20];
    if (Math.abs(cam[1]) < 10 || cam[0] < 12 || ZONES.some(z => z.kind === 'set' && z.id !== '07' && inZone(z, cam[0], cam[1]))) continue;
    if (cv.some(c => Math.hypot(c.x - cam[0], c.z - cam[1]) < 6)) continue;
    if (cv.some(c => segD(c, cam, [p.x, p.z]) < 4.5)) continue;
    return { from: cam, to: [p.x - Math.cos(a) * 25, p.z - Math.sin(a) * 25] };
  }
  return null;
}
function band(n, from, to, text) {
  const shot = clearShot(n); if (shot) { from = shot.from; to = shot.to; }
  full(); persp.fov = 66; persp.position.set(from[0], EYE, from[1]); persp.lookAt(to[0], 1.4, to[1]); signsWithin(90);
  const B = BANDS[n - 1]; caption(`GROUND VIEW · BAND ${n} · L${B.lv[0]}–${B.lv[2]} · ${B.enemy.toUpperCase()}`, text + ' Dark blue bodies with lit eyes = night-shift spawns.'); render(persp);
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
  $('foot').hidden = false; $('foot').textContent = 'Showcase Template · round 2 grey blockout · art/showcase-template/round-2-blockout · labels are burned in';
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
  stats: () => ({ budget: B_, fit: P.fit, grind: G_, onScreen: S_, reach: [R2_, R1_], hubSpan, cover: P.cover.length, chests: P.chests.length, crates: P.crates.length, quests: P.quests.length, lairs: P.lairs, packs: P.packs.length,
    night: P.packs.filter(p => p.night).length }) };
window.labReady = true;
