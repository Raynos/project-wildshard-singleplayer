// Showcase Template grey blockout lab, ROUND 4: builds the measured layout in layout.js as dev-map blocks and frames the
// captures (plan board, budget board, aerial, ground views at 1.7 m eye height). window.lab.show(name) for capture.mjs.
// R3 (Jake 11-03): the hub is a walled town on the west; NE = bands 1-4; SE = bands 5-6 over the gauntlet and the Titan.
// R4 (Jake 11-03, "that town might be a little bit too big"): the town shrinks to 120 m and every west toy gets its own
// labelled footprint. The east is round 3's, untouched.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REAL, HALF, STRIP, AVENUE_HALF, TOWN, PLAZA, ROAD, SEAM_X, GATES, ROAD_GATES, SE_WALL, ZONES, INTERIORS, SECRETS, HUB,
  BEACONS, BANDS, GATE_ELITES, ELITES, ELITE_LAIR_R, LOOKOUT, GOLD, GRIND, CONTRACTS, ARCHES,
  STREETS, BLOCKS, RANGE, MOVERS, GRAPPLE, CLIMB, ROCK, HOVER, PHYSICS, PADDOCK, RIDING, WALKS } from './layout.js';
import { place as placeContent, budget, inZone, zoneArea, coverReach, grind, onScreen, westWalks } from './placement.js';


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
  const k = .0042 * Math.min(w, 34) + .05; s.userData.text = text; s.userData.k = [k, k * c.height / c.width]; s.scale.set(k, k * c.height / c.width, 1); s.position.set(x, y, z); target.add(s); signList.push(s); return s;
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
  sign('04 RIDING COURSE', '208×88 m · 479 m lap = 37 s at gallop · 8 rings', cx, 16, cz, 40);
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

// R4: THE TOWN, 120 x 120 m. Streets and lanes are open; every block fills with lots along its street faces (lots
// 9-15 m wide, 2-4 storeys); the shops, the empty fronts, the zip house, the stable and the gatehouses are reserved.
let tSeed = 31; const trnd = () => (tSeed = (tSeed * 16807) % 2147483647) / 2147483647;
function townPlan() {
  tSeed = 31;
  const out = [], R = (x0, x1, z0, z1, h, kind, label = '', sub = '') => out.push({ x0, x1, z0, z1, h, kind, label, sub });
  for (const s of HUB.services.filter(q => q.shop)) R(...s.box, 9, 'shop', s.name, s.sub);
  for (const t of HUB.toLet) R(...t, 7, 'tolet', 'TO LET', 'room for a future shop');
  const zh = HUB.zipHouse; R(zh.x0, zh.x1, zh.z0, zh.z1, zh.h, 'zip', 'ZIP HOUSE', 'grapple finish on the roof');
  R(...HUB.stable, 7, 'stable', 'STABLE', 'stalls · loaner horses');
  R(-16, -9, -18, -7, 11, 'gatehouse'); R(-16, -9, 7, 18, 11, 'gatehouse');
  const reserved = out.slice(), hit = (a, b, m = 1) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
  for (const [x0, x1, z0, z1] of BLOCKS) {
    const wide = x1 - x0 >= z1 - z0, depth = wide ? z1 - z0 : x1 - x0, len = wide ? x1 - x0 : z1 - z0;
    const rows = depth >= 22 ? [[0, depth / 2], [depth / 2, depth]] : [[0, depth]];
    for (const [r0, r1] of rows) {
      let u = 0;
      while (u < len - 6) {
        const w = Math.min(len - u, 9 + Math.floor(trnd() * 7)), d = (r1 - r0) - (trnd() < .4 ? Math.floor(trnd() * 3) : 0);
        const front = r0 === 0 ? r0 : r1 - d;
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
function pbBoard(x, z, title, ry = 0) {   // a personal-best board: every course has one at its start
  place(() => { box(3.6, 2.4, .3, 0, 1, 0, M.cyan); for (const s of [-1.5, 1.5]) box(.2, 1, .2, s, 0, 0, M.dark, { edges: false }); }, x, z, ry);
  sign(title, 'PERSONAL BEST', x, 5, z, 10);
}
function ladder(x, z, h, ry = 0) {   // two rails and rungs every 0.5 m
  place(() => { for (const s of [-.3, .3]) box(.1, h, .1, s, 0, 0, M.dark, { edges: false }); for (let y = .4; y < h; y += .5) box(.6, .06, .06, 0, y, 0, M.dark, { edges: false, shadow: false }); }, x, z, ry);
}
function ropeBridge(a, b, drop = 1.2) {   // a, b = [x, y, z]: planks on a sagging curve, rope rails 1 m above
  const pts = sag(a, b, drop, 26), dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], seg = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const m = add(new THREE.BoxGeometry(seg * .78, .1, 1.5), M.dirt, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, { edges: false });
    m.rotation.order = 'YZX'; m.rotation.set(0, ry, Math.atan2(q[1] - p[1], Math.hypot(q[0] - p[0], q[2] - p[2])));
  }
  for (const s of [-.8, .8]) { const ox = -dz / L * s, oz = dx / L * s; cable(sag([a[0] + ox, a[1] + 1.1, a[2] + oz], [b[0] + ox, b[1] + 1.1, b[2] + oz], drop * .8), 0x6b4a2a, .06); }
}
function buildTown() {
  flatRect(TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1, 0.035, cobble);
  for (const [x0, x1, z0, z1] of STREETS) flatRect(x0, x1, z0, z1, 0.045, street);
  flatRect(PLAZA.x0, TOWN.x1, PLAZA.z0, PLAZA.z1, 0.05, M.light);
  // the town wall (5 m, walk on top) with its six gates
  const gapAt = side => GATES.filter(g => (side === 'N' && g.z === TOWN.z0) || (side === 'S' && g.z === TOWN.z1) || (side === 'W' && g.x === TOWN.x0) || (side === 'E' && g.x === TOWN.x1)).map(g => side === 'N' || side === 'S' ? g.x : g.z);
  const run = (a, b, gaps, f) => { let s = a; for (const g of [...gaps].sort((p, q) => p - q)) { if (g - 6 > s) f(s, g - 6); s = g + 6; } if (b > s) f(s, b); };
  for (const [side, zc] of [['N', TOWN.z0], ['S', TOWN.z1]]) run(TOWN.x0, TOWN.x1, gapAt(side), (a, b) => box(b - a, TOWN.wall, 1.2, (a + b) / 2, 0, zc, wallC));
  for (const [side, xc] of [['W', TOWN.x0], ['E', TOWN.x1]]) run(TOWN.z0, TOWN.z1, gapAt(side), (a, b) => box(1.2, TOWN.wall, b - a, xc, 0, (a + b) / 2, wallC));
  for (const g of GATES) {
    const ns = g.z === TOWN.z0 || g.z === TOWN.z1;
    for (const s of [-1, 1]) box(2.2, 9, 2.2, g.x + (ns ? s * 6.5 : 0), 0, g.z + (ns ? 0 : s * 6.5), M.orangeDark);
    box(ns ? 15 : 2.2, 1.2, ns ? 2.2 : 15, g.x, 7.8, g.z, M.orangeDark);
    sign(g.name, g.to, g.x, 12, g.z, g.id === 'E' ? 24 : 18);
  }
  const walls = [M.light, M.white, M.grey, cobble];
  TOWN_B.forEach((b, i) => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (b.kind === 'house') { box(w - .3, b.h, d - .3, cx, 0, cz, walls[i % 4]); if (b.roof) gable(w - .3, d - .3, cx, b.h, cz, i % 3 ? M.orange : M.orangeDark); else box(w, .5, d, cx, b.h, cz, M.orangeDark); return; }
    if (b.kind === 'gatehouse') { box(w, b.h, d, cx, 0, cz, wallC); box(w + .6, .6, d + .6, cx, b.h, cz, M.orangeDark); return; }
    const m = b.kind === 'shop' ? M.orange : b.kind === 'tolet' ? M.grey : b.kind === 'zip' ? M.light : M.dirt;
    box(w, b.h, d, cx, 0, cz, m); box(w + .6, .6, d + .6, cx, b.h, cz, b.kind === 'zip' ? M.cyan : M.orangeDark);
    if (b.kind === 'shop' || b.kind === 'tolet') {   // awning on the street face
      const fz = cz < 0 ? b.z1 : b.z0;
      box(w - 1, .25, 3, cx, 3.2, fz + (cz < 0 ? 1.5 : -1.5), b.kind === 'shop' ? M.cyan : M.light);
      if (b.kind === 'shop') box(.25, .25, d - 2, b.x1 + 1.5, 3.2, cz, M.cyan);
    }
    if (b.kind === 'stable') for (let k = 0; k < 4; k++) box(.4, 2.4, 6, b.x0 + 3 + k * 5, 0, b.z1 + 3, M.dark);
    if (b.kind === 'shop') sign(b.label, b.sub, cx, 6.4, cz < 0 ? b.z1 + 3 : b.z0 - 3, 16);
    else if (b.kind === 'tolet') sign(b.label, b.sub, cx, 5.4, cz < 0 ? b.z1 + .4 : b.z0 - .4, 12);
    else if (b.kind === 'zip') { sign('ZIP HOUSE', 'grapple-course FINISH on the roof', cx, 6.5, b.z1 + .4, 14); sign('FINISH', 'timer stops on landing', cx, b.h + 3, cz, 10); }
    else sign(b.label, b.sub, cx, b.h + 2.6, cz, 12);
  });
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
  for (const [x, z] of [[-24, -7], [-24, 7], [-48, 7]]) { box(3.2, 1, 2, x, 0, z, M.dirt); for (const dx of [-1.5, 1.5]) box(.15, 2.6, .15, x + dx, 0, z - .9, M.dark, { edges: false }); box(3.8, .2, 2.6, x, 2.6, z, [M.orange, M.cyan, M.white][Math.abs(x + z) % 3]); }
  for (const [x, z] of [[-54, -18], [-18, -18], [-54, 18], [-18, 18]]) { box(.25, 4.5, .25, x, 0, z, M.dark, { edges: false }); box(.7, .5, .7, x, 4.5, z, M.glow, { edges: false }); }
  const ob = HUB.obelisk;
  box(5, 1.5, 5, ob.x, 0, ob.z, M.grey); add(new THREE.CylinderGeometry(.5, 1.4, ob.h - 1.5, 4), M.orange, ob.x, 1.5 + (ob.h - 1.5) / 2, ob.z, { ry: Math.PI / 4, edges: true });
  add(new THREE.OctahedronGeometry(1.1), M.cyan, ob.x, ob.h + .6, ob.z);
  sign('OBELISK', 'the town landmark · 22 m', ob.x, ob.h + 4, ob.z, 14);
  sign('01 TOWN', '120×120 m · gate plaza · Main Street · six gates', -68, 30, 0, 34);
  sign('GATE PLAZA', '40×40 m · quests · contracts · trophies', -36, 14, -2, 22);
  sign('MAIN STREET · SHOP ROW', '', -92, 7, 0, 22);
}
function buildPaddock() {
  const zn = ZONES.find(z => z.id === 'MP'), cx = PADDOCK.chuteX;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.dirt);
  const rail = (a, b, c, d) => box(Math.max(.25, b - a), 1.3, Math.max(.25, d - c), (a + b) / 2, 0, (c + d) / 2, M.white, { edges: false });
  rail(zn.x0, cx - 6, zn.z0, zn.z0); rail(cx + 6, zn.x1, zn.z0, zn.z0); rail(zn.x0, zn.x0, zn.z0, zn.z1); rail(zn.x1, zn.x1, zn.z0, zn.z1);
  rail(zn.x0, -42, zn.z1, zn.z1); rail(-30, zn.x1, zn.z1, zn.z1);
  for (const s of [-1, 1]) box(.3, 1.4, 14, cx + s * 6, 0, zn.z0 - 7, M.white, { edges: false });   // the chute onto the oval
  const [hx, hz] = PADDOCK.horse;
  box(2.4, 1.1, .9, hx, 1.1, hz, M.dirt); box(.8, 1.2, .6, hx + 1.4, 1.8, hz, M.dirt); for (const [dx, dz] of [[-.9, -.3], [-.9, .3], [.9, -.3], [.9, .3]]) box(.2, 1.1, .2, hx + dx, 0, hz + dz, M.dark, { edges: false });
  sign('LOANER HORSE', 'from the stable hand', hx, 4.6, hz, 10);
  box(2, .8, 2, PADDOCK.block[0], 0, PADDOCK.block[1], M.grey); box(4, .7, 1.2, PADDOCK.trough[0], 0, PADDOCK.trough[1], M.water);
  sign('PADDOCK', 'the riding course entrance', -38, 8, -118, 18);
  // the riding course's lap-timer gantry on the south straight, with its personal-best board
  const gx = RIDING.gantryX, tz = RIDING.trackZ;
  for (const s of [-1, 1]) box(.8, 6.5, .8, gx, 0, tz + s * 7.2, M.orangeDark);
  box(.8, 1.4, 15.2, gx, 6.5, tz, M.orangeDark); box(.3, 1, 8, gx - .5, 6.7, tz, M.cyan, { edges: false });
  sign('START · FINISH', 'lap timer · 479 m lap', gx, 10.5, tz, 16);
  pbBoard(RIDING.pb[0], RIDING.pb[1], 'RIDING LAP');
}
function buildMovers() {   // R4: a straight run of six stations, east -> west, 0 -> 18 m
  const zn = ZONES.find(z => z.id === '05'), z = MOVERS.z;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.light);
  flatDisc(MOVERS.start[0], MOVERS.start[1], 3, .07, M.cyan); sign('START', 'movers sequence · timed', MOVERS.start[0], 4.5, MOVERS.start[1], 12);
  pbBoard(MOVERS.pb[0], MOVERS.pb[1], 'MOVERS TIME');
  for (let k = 0; k < 3; k++) {   // 1 conveyors: three belts, alternating direction
    const x = -83 - k * 6.6; box(6, .4, 4, x, 0, z, M.dark);
    for (let c = -1; c <= 1; c++) box(.5, .08, 2.6, x + c * 1.8, .4, z, M.cyan, { edges: false, ry: (k % 2 ? 1 : -1) * .5 });
  }
  for (const x of [-105, -110, -115]) cyl(1.4, 1.4, .3, x, 0, z, M.cyan, { seg: 16 });   // 2 jump pads
  box(6, .6, 8, -121, 5.4, z, M.orange); for (const [dx, dz] of [[-2.6, -3.6], [2.6, -3.6], [2.6, 3.6], [-2.6, 3.6]]) box(.4, 5.4, .4, -121 + dx, 0, z + dz, M.dark, { edges: false });   // the 6 m ledge they reach
  flatRect(-140, -124, z - 9, z + 9, .06, M.hazard);                                        // 3 the pit under the sliders
  [[-127.5, -4], [-132.5, 3], [-137.5, -2]].forEach(([x, dz]) => { box(.3, .3, 18, x, 5.1, z, M.dark, { edges: false }); box(4, .6, 4, x, 5.4, z + dz, M.orange); });
  box(1.2, 5.2, 1.2, -147, 0, z, M.dark); cyl(5, 5, .8, -147, 5.2, z, M.orange, { seg: 24 }); box(10, .5, .5, -147, 7, z, M.hazard);   // 4 spinner + sweep arm
  for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]]) box(.4, 18, .4, -157 + dx, 0, z + dz, M.dark);         // 5 lift shaft
  box(4.4, .6, 4.4, -157, 11, z, M.cyan); box(3, 6, 6, -153.5, 0, z + 5, M.grey);
  box(8, 1, 10, -164, 17, z, M.orange); for (const [dx, dz] of [[-3.5, -4.5], [3.5, -4.5], [3.5, 4.5], [-3.5, 4.5]]) box(.5, 17, .5, -164 + dx, 0, z + dz, M.dark, { edges: false });   // 6 top deck
  ropeBridge([-168, 18, z], [GRAPPLE.tank.x + GRAPPLE.tank.r, 18, GRAPPLE.tank.z], 1.6);
  for (const s of MOVERS.stations) sign(`${s.n} ${s.name}`, s.note, (s.x0 + s.x1) / 2, Math.max(s.y, 6) + (s.n === 6 ? 7 : 5), z + (s.n % 2 ? -7 : 7), 12);
  sign('05 MOVERS SEQUENCE', '98×58 m · six stations · 0 → 18 m', -120, 30, z, 30);
}
function buildGrapple() {   // R4: a timed course: start, 2 hook poles, tank, mast, tower, zip into town
  const G = GRAPPLE, T = G.tank, Mt = G.mast, W = G.tower;
  flatDisc(G.start[0], G.start[1], 3, .07, M.cyan); sign('GRAPPLE START', 'timer starts · ends on the zip-house roof', G.start[0], 5, G.start[1], 16);
  pbBoard(G.pb[0], G.pb[1], 'GRAPPLE TIME', -Math.PI / 4);
  for (const p of G.poles) { box(.9, p.h, .9, p.x, 0, p.z, M.dark); add(new THREE.SphereGeometry(1.2, 12, 8), M.cyan, p.x, p.h + .6, p.z); sign(`HOOK ${p.n}`, `${p.h} m pole`, p.x, p.h + 4, p.z, 10); }
  cyl(T.r, T.r, T.h, T.x, 0, T.z, M.tank, { seg: 32 }); cyl(T.r + .3, T.r + .3, 1.2, T.x, T.h - 1.2, T.z, M.orange, { seg: 32 });
  ladder(T.x + T.r + .4, T.z + 6, T.h, Math.PI / 2);
  sign('HOOK 3 · WATER TANK', '18 m roof · vista · ladder', T.x, T.h + 8, T.z, 18);
  box(1.4, Mt.h, 1.4, Mt.x, 0, Mt.z, M.dark); add(new THREE.SphereGeometry(1.4, 12, 8), M.cyan, Mt.x, Mt.h + .6, Mt.z);
  sign('HOOK 4 · MAST', '28 m', Mt.x, Mt.h + 5, Mt.z, 12);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(1.2, W.h, 1.2, W.x + dx * (W.half - 1), 0, W.z + dz * (W.half - 1), M.orange);
  for (let y = 9; y < W.h; y += 9) box(2 * W.half, .6, 2 * W.half, W.x, y, W.z, M.orangeDark);
  box(5, 3, 5, W.x, W.h, W.z, M.cyan); ladder(W.x + W.half + .3, W.z, 9, Math.PI / 2);
  const zh = HUB.zipHouse; cable(sag([W.x, W.h, W.z], [(zh.x0 + zh.x1) / 2, zh.h + 2, (zh.z0 + zh.z1) / 2], 6, 20));
  sign('HOOK 5 · GRAPPLE TOWER', '45 m · decks every 9 m · zip 99 m', W.x, W.h + 9, W.z, 24);
  sign('ZIPLINE 99 m', '103 m of cable · 4.7 s at 22 m/s → the town', -164, 34, -26, 14);
  sign('06 GRAPPLE COURSE', 'start → hooks 1–5 → zip → finish in town', -200, 58, -80, 30);
}
function buildClimb() {   // R4 new: ladders, a scramble wall, three platforms and swaying rope bridges
  const zn = ZONES.find(z => z.id === '10'), D = Object.fromEntries(CLIMB.decks.map(d => [d.id, d]));
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.dirt);
  const [sx0, sx1, sz0, sz1] = CLIMB.scramble;
  for (let i = 0; i < 5; i++) box((sx1 - sx0) / 5, 1.3 * (i + 1), sz1 - sz0, sx0 + (i + .5) * (sx1 - sx0) / 5, 0, (sz0 + sz1) / 2 + (i % 2) * .8, M.grey);   // scramble wall up to deck A
  for (const d of CLIMB.decks) {
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) box(.5, d.h, .5, d.x + dx, 0, d.z + dz, M.dark, { edges: false });
    box(6.4, .6, 6.4, d.x, d.h - .6, d.z, M.orange); ladder(d.x, d.z + 3.4, d.h);
    sign(`DECK ${d.id} · ${d.h} m`, 'ladder', d.x, d.h + 4, d.z, 10);
  }
  ropeBridge([D.A.x + 3, D.A.h, D.A.z + 2], [D.B.x - 3, D.B.h, D.B.z - 2], 1.4);
  ropeBridge([D.B.x - 3, D.B.h, D.B.z + 2], [D.C.x + 3, D.C.h, D.C.z - 1], 1.4);
  ropeBridge([D.C.x - 3, D.C.h, D.C.z - 1], [ROCK.x + 8, ROCK.h, ROCK.z + 6], 1.8);
  sign('SCRAMBLE WALL', 'up to deck A', (sx0 + sx1) / 2, 9, sz0 - 1, 12);
  sign('ROPE BRIDGES', 'swaying · A → B → C → the Rock', -158, 22, 50, 16);
  sign('10 CLIMB YARD', '40×56 m · ladders · scramble · bridges', -156, 26, 30, 26);
}
function buildRock() {   // R4: a free-standing crag west of the town; the squeeze cave runs through it
  const m = add(new THREE.CylinderGeometry(9, ROCK.rx, ROCK.h, 6), M.grey, ROCK.x, ROCK.h / 2, ROCK.z, { edges: true }); m.scale.set(1, 1, ROCK.rz / ROCK.rx);
  box(2.4, .5, .7, LOOKOUT.x, ROCK.h, LOOKOUT.z, M.white); sign('LOOKOUT ★', 'tower, climb yard, town in one frame', LOOKOUT.x, ROCK.h + 4, LOOKOUT.z, 14);
  for (let i = 0; i < 7; i++) box(4, 2.2 * (i + 1) * .33 + 1, 3, -216 + (i % 2) * 2, 0, 72 - i * 2.6, M.grey);   // scramble route up the south face
  sign('SCRAMBLE ROUTE', 'south face', -216, 10, 76, 12);
  box(3, ROCK.h, 3, ROCK.ladder[0], 0, ROCK.ladder[1] + 1.5, M.grey); ladder(ROCK.ladder[0], ROCK.ladder[1] - .3, ROCK.h);   // ladder chimney, north face
  sign('LADDER', '16 m', ROCK.ladder[0], 8, ROCK.ladder[1] - 2, 8);
  for (const [x, z, t] of [[...ROCK.caveN, 'north mouth'], [...ROCK.caveS, 'south mouth']]) { box(5, 3.5, 1.4, x, 0, z, M.dark, { edges: false }); sign('SQUEEZE CAVE', `${t} · 60 m through`, x, 6, z + (z < ROCK.z ? -2 : 2), 12); }
  sign('THE ROCK', '16 m crag · lookout · squeeze cave', ROCK.x, 26, ROCK.z, 26);
}
function buildRange() {   // R4: melee yard + five lanes, firing south from z 80
  const zn = ZONES.find(z => z.id === '02'), R = RANGE, me = R.melee;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.light);
  flatRect(zn.x0, me.x0, R.firingZ - .4, R.firingZ + .4, .07, M.hazard);   // the firing line, painted; a shooting shelf at each lane's side
  for (const l of R.lanes) box(2.4, 1.1, 1, l.x + 3.6, 0, R.firingZ - 1, M.orangeDark);
  for (let i = 0; i <= 5; i++) box(.4, .6, R.bermZ[0] - R.firingZ, zn.x0 + i * 11.6, 0, (R.firingZ + R.bermZ[0]) / 2, M.grey);
  for (const l of R.lanes) {
    for (const d of l.d) {
      const z = R.firingZ + d; flatRect(l.x - 5, l.x + 5, z - .2, z + .2, .06, M.dark);
      if (l.ammo && d === 20) {   // ammo practice: iron (plank), pitch (straw bale, burns), broadhead (soft target)
        box(1.4, 1.8, .3, l.x - 3.5, 0, z, M.white); cyl(.8, .8, 1.6, l.x, 0, z, M.dirt, { seg: 12 }); add(new THREE.ConeGeometry(.6, 1.6, 10), M.flame, l.x, 2.3, z, { shadow: false }); capsule(l.x + 3.5, z, 1.8, .45, M.orange);
        continue;
      }
      box(.2, 1, .2, l.x, 0, z, M.dark, { edges: false }); box(1.4, 1.4, .3, l.x, 1, z, M.white); cyl(.35, .35, .32, l.x, 1.55, z - .05, M.hazard, { rx: Math.PI / 2, seg: 16, edges: false });
    }
    sign(l.name, `${l.d[0]}–${l.d[l.d.length - 1]} m`, l.x, 3.6, R.firingZ + 5, 10);
  }
  sign('AMMO PRACTICE', 'iron · pitch (bale burns) · broadhead', R.lanes[1].x, 6, R.firingZ + 22, 14);
  box(zn.x1 - zn.x0, 10, R.bermZ[1] - R.bermZ[0], (zn.x0 + zn.x1) / 2, 0, (R.bermZ[0] + R.bermZ[1]) / 2, M.grey);
  flatRect(me.x0, me.x1, me.z0, me.z1, .05, M.dirt); box(.3, 1.2, me.z1 - R.firingZ - 2, me.x0, 0, (R.firingZ + me.z1) / 2 + 1, M.white, { edges: false });
  for (const [x, z] of me.sword) { capsule(x, z, 1.9, .45, M.orange); box(1.8, .25, .25, x, 1.3, z, M.dark, { edges: false }); }
  for (const [x, z] of me.spear) { box(.3, 2.4, .3, x, 0, z, M.dark, { edges: false }); add(new THREE.TorusGeometry(.6, .12, 8, 20), M.hazard, x, 2, z - .2); }
  sign('SWORD DUMMIES', 'combos · parry', -24, 5, me.sword[0][1] - 3, 12); sign('SPEAR DUMMIES', 'reach · ring targets', -24, 5, me.spear[0][1] - 3, 12);
  pbBoard(R.pb[0], R.pb[1], 'RANGE SCORE');
  sign('02 WEAPON RANGE', '78×102 m · out of the Range Gate', -54, 18, 128, 32);
}
function buildHover() {   // R4: the hover park alone (the physics toys have their own yard)
  const zn = ZONES.find(z => z.id === '11'), H = HOVER;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.light);
  const pts = [[-9, 0], [9, 0], [9, 4.5], [8, 4.5]]; for (let i = 0; i <= 8; i++) { const a = -i / 8 * Math.PI / 2; pts.push([4 + 4 * Math.cos(a), 4.5 + 4 * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - i / 8 * Math.PI / 2; pts.push([-4 + 4 * Math.cos(a), 4.5 + 4 * Math.sin(a)]); } pts.push([-9, 4.5]);
  const L = H.halfpipe.z1 - H.halfpipe.z0, hp = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), { depth: L, bevelEnabled: false });
  hp.translate(0, 0, -L / 2); add(hp, M.orange, H.halfpipe.x, 0, (H.halfpipe.z0 + H.halfpipe.z1) / 2, { edges: true });
  sign('HALFPIPE', '45 m · 4.5 m walls', H.halfpipe.x, 10, H.halfpipe.z0 - 2, 12);
  for (const [z, h] of H.kickers) { wedge(7, h, 5, H.kickerX, z, Math.PI, M.orange); flatRect(H.kickerX + 3.5, H.runup[0], z - 1, z + 1, .06, M.cyan); }
  sign('KICKERS ×3', '1.6 · 2.4 · 3.2 m · 45 m run-up', H.kickerX, 8, H.kickers[1][0], 14);
  const qp = new THREE.Shape([new THREE.Vector2(0, 0), ...Array.from({ length: 9 }, (_, i) => { const t = i / 8 * Math.PI / 2; return new THREE.Vector2(5 * Math.sin(t), 5 - 5 * Math.cos(t)); }), new THREE.Vector2(6, 5), new THREE.Vector2(6, 0)]);
  for (const [x, z, ry] of H.quarters) { const g = new THREE.ExtrudeGeometry(qp, { depth: 14, bevelEnabled: false }); g.translate(0, 0, -7); add(g, M.orange, x, 0, z, { ry, edges: true }); }
  sign('QUARTER PIPES', '5 m, facing', (H.quarters[0][0] + H.quarters[1][0]) / 2, 9, H.quarters[0][1] - 8, 12);
  const [fx, fz] = H.funbox; box(10, 1.8, 10, fx, 0, fz, M.orangeDark); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; wedge(5, 1.8, 10, fx + Math.cos(a) * 7.5, fz - Math.sin(a) * 7.5, a + Math.PI, M.orange); }
  sign('FUNBOX', '4 ramps', fx, 6, fz, 8);
  for (const [x, z] of H.rails) { box(20, .15, .15, x, .7, z, M.dark, { edges: false }); for (const dx of [-9, 0, 9]) box(.15, .7, .15, x + dx, 0, z, M.dark, { edges: false }); }
  sign('GRIND RAILS ×3', '20 m', H.rails[1][0], 5, H.rails[1][1], 10);
  const [bx, bz, br] = H.bowl; flatDisc(bx, bz, br - 4, .05, M.grey); ringWall(bx, bz, [[br - 4, 0], [br, 3.5], [br + 1, 3.5], [br + 1, 0]], M.orange);
  sign('BOWL', `⌀${2 * br} m`, bx, 8, bz, 8);
  flatDisc(H.start[0], H.start[1], 3, .07, M.cyan); sign('TRICK START', 'combo score · 90 s run', H.start[0], 5, H.start[1] - 2, 12);
  pbBoard(H.pb[0], H.pb[1], 'TRICK SCORE');
  sign('11 HOVER PARK', '134×122 m · hover only', -168, 18, 172, 32);
}
function buildPhysics() {   // R4: the physics toys and the pressure-plate puzzle, south of the range
  const zn = ZONES.find(z => z.id === '03'), Q = PHYSICS;
  flatRect(zn.x0, zn.x1, zn.z0, zn.z1, 0.04, M.light);
  for (const [x, z] of Q.plates) box(4, .25, 4, x, 0, z, M.cyan);
  const [gx, gz0, gz1] = Q.plateGate; box(1, 4, gz1 - gz0, gx, 0, (gz0 + gz1) / 2, M.orangeDark);
  sign('PRESSURE PLATES ×3', 'crates, balls or you · open the gate', -72, 6, Q.plates[0][1] - 3, 16);
  for (const [cx, cz] of Q.crates) for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) box(2, 2, 2, cx + i * 2.1 + r * 1.05, r * 2, cz, M.orangeDark);
  sign('PHYSICS CRATES', 'push · stack · carry', Q.crates[1][0], 8, Q.crates[1][1], 12);
  for (const [x, z] of Q.seesaws) { wedge(3, 1.6, 3, x, z, 0, M.dark); box(14, .4, 2.6, x, 1.5, z, M.orange, { rz: .2 }); }
  sign('SEE-SAWS ×2', '', (Q.seesaws[0][0] + Q.seesaws[1][0]) / 2, 5, Q.seesaws[0][1], 10);
  const br = Q.ballRun; wedge(br.x1 - br.x0, br.h, 4, (br.x0 + br.x1) / 2, br.z, 0, M.orange);
  for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(.8, 16, 12), M.hazard, br.x1 - 1.5 - k * 1.8, br.h * (1 - (1.5 + k * 1.8) / (br.x1 - br.x0)) + .8, br.z);
  for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) cyl(.22, .3, 1.3, Q.skittles[0] - r * 1.2, 0, Q.skittles[1] + (i - r / 2) * 1.1, M.white, { seg: 10 });
  sign('ROLLING BALLS', 'ramp → skittles', (br.x0 + br.x1) / 2, 10, br.z, 12);
  sign('03 PHYSICS YARD', '78×54 m · plates · crates · see-saws · balls', -52, 16, 214, 30);
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
place(buildRiding, -252, -21);
buildRange(); buildMovers(); buildGrapple(); buildClimb(); buildRock(); buildHover(); buildPhysics();
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
  if (zn.shape === 'rects') for (const [x0, x1, z0, z1] of zn.list) { const mesh = put(new THREE.PlaneGeometry(x1 - x0, z1 - z0)); mesh.position.set((x0 + x1) / 2, 59, (z0 + z1) / 2); budgetOnly.add(mesh); }
}
{ // R4: the west routes on the plans: the grapple course (start -> hooks -> zip -> finish) and the movers sequence
  const G = GRAPPLE, zh = HUB.zipHouse, route = (pts, color, dashed) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 63, z)));
    const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 3, gapSize: 2, depthTest: false }) : new THREE.LineBasicMaterial({ color, depthTest: false }));
    if (dashed) l.computeLineDistances(); l.renderOrder = 13; planOnly.add(l);
  };
  route([G.start, [G.poles[0].x, G.poles[0].z], [G.poles[1].x, G.poles[1].z], [G.tank.x, G.tank.z], [G.mast.x, G.mast.z], [G.tower.x, G.tower.z]], 0xc3249b, false);
  route([[G.tower.x, G.tower.z], [(zh.x0 + zh.x1) / 2, (zh.z0 + zh.z1) / 2]], 0xc3249b, true);
  route([MOVERS.start, [-80, MOVERS.z], [-168, MOVERS.z], [G.tank.x + G.tank.r, G.tank.z]], 0x1238c8, false);
  route([[CLIMB.decks[0].x, CLIMB.decks[0].z], [CLIMB.decks[1].x, CLIMB.decks[1].z], [CLIMB.decks[2].x, CLIMB.decks[2].z], [ROCK.x + 8, ROCK.z + 6]], 0x6b4a2a, true);
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
function project(x, z, size) { const [w, h] = Array.isArray(size) ? size : [size, size]; return [(x - frame.x0) / (frame.x1 - frame.x0) * w, (z - frame.z0) / (frame.z1 - frame.z0) * h]; }
function mark(L, x, z, size, text, color, fs = 9, cls = 'tick') { const [px, pz] = project(x, z, size), [sw_, sh_] = Array.isArray(size) ? size : [size, size]; if (px < 0 || pz < 0 || px > sw_ || pz > sh_) return; const d = document.createElement('div'); d.className = cls; d.style.color = color; d.style.fontSize = fs + 'px'; d.style.fontWeight = '700'; d.style.textShadow = '0 0 2px #000, 0 0 2px #000'; d.innerHTML = text; d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d); }
const G0 = GRAPPLE;
const OFF = { '01': [0, -38], '05': [0, -12], '06': [0, 0], 'K': [0, -22], '09': [0, 10], '08': [0, 0], '11': [0, 0], 'B1': [0, 0], 'B6': [0, -6], 'B4': [-30, 0], 'B5': [0, -38], 'B2': [-22, 34], 'M6': [0, 18], 'TV': [-10, 18], 'MP': [0, 0], 'H': [0, 46], '07': [0, 30], '04': [0, 0], '02': [0, 0], 'B3': [0, 0], '03': [0, 0], '10': [0, 0] };
// R4: on the whole-cell plan every west zone also lists what is in it
const WEST_SUB = {
  '01': 'plaza · Main St · 6 NPCs · 6 gates', '02': 'dummies · 2 bow · 2 xbow + ammo · rifle 75 m', '03': 'plates · crates · see-saws · balls',
  '04': '8 rings · 4 jumps · lap timer', '05': 'six stations · 0 → 18 m',
  '06': 'start · hooks 1–5 · zip 99 m', '11': 'halfpipe · kickers · QPs · funbox · rails · bowl',
  // the east views are round 3's (the east is unchanged)
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
  ne1() { shot([24, -122], 30, Math.PI / 2, 70); signsWithin(90); caption('GROUND VIEW · NE · BAND 1 → BAND 2', 'From band 1\'s top tier (Crate Mites, L3) through the arch into band 2: Pallet Jacks among grey walls; every band change in the NE is an arch with the band\'s name and levels on it.'); render(persp); },
  ne2() { shot([224, -122], 30, -Math.PI / 2, 70); signsWithin(100); caption('GROUND VIEW · NE · BAND 3 → BAND 4 · the vault', 'From band 3\'s top tier through the arch into band 4: Welder bays, and the Training Vault gatehouse at the band\'s east edge.'); render(persp); },
  se() { shot([126, 66], 36, Math.PI, 70); signsWithin(100); caption('GROUND VIEW · SE · BAND 6 → THE STEALTH YARD (band 5)', 'Band 6 is its own section: Arc Sentry pairs behind 3 m arc screens and half-height covers. Beyond the yard\'s west gate, band 5\'s Riveter patrols and their cones; beacon towers on the yard corners.'); render(persp); },
  gauntlet() { full(); persp.fov = 60; persp.position.set(62, EYE, 132); persp.lookAt(62, 3, 182); signsWithin(120); caption('GROUND VIEW · SE BOTTOM · THE GAUNTLET (L16–18)', 'Through the gauntlet gate in the SE half wall: the wave arena, 56 m floor and seating back to r 42, alone in the bottom half with the Titan; Foreman Unit 7 (L18) is the finale.'); render(persp); },
  boss() { full(); persp.fov = 62; persp.position.set(108, EYE + .4, 192); persp.lookAt(198, 6, 192); signsWithin(140); caption('GROUND VIEW · CRATE TITAN L20 · on the approach', 'The very bottom right: the 39 × 16 m approach for the in-engine intro (cyan camera pads) into the r 28 floor, entered from the forecourt next to the gauntlet.'); render(persp); },
};
const WEST_IDS = new Set(['01', '02', '03', '04', 'MP', '05', '06', '10', 'H', '11']);
function planLabels(size, top, mode) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  if (mode !== 'place') for (const zn of ZONES) {
    if (mode === 'cmp' && !WEST_IDS.has(zn.id)) continue;
    const [cx, cz] = zoneCentre(zn), [ox, oz] = OFF[zn.id] ?? [0, 0];
    const [px, pz] = project(cx + ox, cz + oz, size);
    const d = document.createElement('div'); d.className = 'lb ' + (zn.kind === 'cand' ? 'cand' : '');
    d.innerHTML = zn.kind === 'band' ? `${zn.name}<i>${fmt(zoneArea(zn))} m²</i>` : zn.id === 'M6' ? zn.name : `${/^[0-9]/.test(zn.id) ? zn.id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>${mode === 'plan' && WEST_SUB[zn.id] ? `<i>${WEST_SUB[zn.id]}</i>` : ''}`;
    if (zn.id === '01') { d.style.fontSize = mode === 'cmp' ? '7.4px' : '9px'; d.style.background = '#ffffffcc'; d.style.padding = '1px 3px'; }
    d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d);
  }
  if (mode === 'cmp') return;
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
// R4: the WEST close-up: every west item gets its own label. tag = dark text on a white halo (like the zone labels).
const westNo = { b: SECRETS.filter(q => q.k === 'b' && q.x < 0), c: SECRETS.filter(q => q.k === 'c'), g: GOLD.filter(g => g.x < 0) };
function westLabels(size, top) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  const tag = (x, z, html, fs = 6.2, color = '#111', bg = '') => { const [px, pz] = project(x, z, size); const d = document.createElement('div'); d.className = 'lb'; d.style.fontSize = fs + 'px'; d.style.color = color; if (bg) { d.style.background = bg; d.style.padding = '0 2px'; } d.innerHTML = html; d.style.left = px + 'px'; d.style.top = pz + 'px'; L.appendChild(d); };
  const title = (id, x, z) => { const zn = ZONES.find(q => q.id === id); tag(x, z, `${/^[0-9]/.test(id) ? id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>`, 8, '#111', '#ffffffd9'); };
  for (let v = -250; v <= 0; v += 50) mark(L, v, -252, size, v, '#e9e9e9', 6.5);
  for (let v = -200; v <= 200; v += 50) mark(L, -249, v, size, v, '#e9e9e9', 6.5);
  // zone titles
  title('04', -122, -200); title('MP', -38, -124); title('05', -119, -126); title('06', -205, -140); title('01', -76, -46);
  title('10', -150, 84); title('H', -206, 100); title('11', -160, 112); title('02', -53, 143); title('03', -53, 229);
  // town
  tag(-36, -26, 'QUEST BOARD<i>G1 Yard Boss · G2 Surveyor · G3 Shift Boss</i>'); tag(-38, -7, 'GATE PLAZA', 5.6); tag(-38, 7, 'OBELISK', 5.2);
  tag(-35, 24, 'TROPHY WALL · CONTRACTS', 5.6); tag(-51, 10, 'FEATS', 5);
  tag(-63, -14, 'TINKER<br>ROOK', 5.4); tag(-63, 14, 'WEAPONS<br>SHOP', 5.4);
  tag(-83, -12, 'TO LET', 5); tag(-83, 12, 'TO LET', 5); tag(-112, 12, 'TO LET', 5.4);
  tag(-115, -17, 'ZIP HOUSE<i>grapple FINISH</i>', 5.6); tag(-19, -47, 'STABLE<i>+ stable hand</i>', 5.6); tag(-111, 1, 'MAIN STREET', 5, '#333');
  for (const n of HUB.npcs) mark(L, n.x, n.z, size, '●', n.giver ? '#ffd23a' : '#1fd3e8', 7);
  for (const g of GATES) { const out = g.id === 'E' ? [5, 7] : g.id === 'W' ? [-7, 8] : g.z < 0 ? [0, -6] : [0, 6]; mark(L, g.x, g.z, size, '⛩', '#ffd9b0', 9); tag(g.x + out[0], g.z + out[1], g.name, 5, '#7a3a0e'); }
  // riding + paddock
  tag(-80, -160, 'START · FINISH<i>lap timer gantry</i>', 5.8); tag(-80, -136, 'PB', 5.6, '#0a6b78'); tag(-122, -229, '4 JUMPS', 5.6); tag(-176, -186, '8 RINGS<i>round the lap</i>', 5.6);
  tag(-30, -104, 'LOANER HORSE', 5.6); tag(-28, -140, 'CHUTE', 5.4); tag(-52, -95, 'trough · block', 5.2, '#444');
  // movers: numbered stations
  const SHORT = ['CONVEYORS', 'JUMP PADS', 'SLIDERS', 'SPINNER', 'LIFT 6→18 m', 'TOP DECK 18 m'], AT = [[-90, -113], [-110, -93], [-132, -113], [-147, -93], [-157, -116], [-170, -88]];
  for (const s of MOVERS.stations) { mark(L, s.n === 6 ? -169 : s.n === 5 ? -155 : (s.x0 + s.x1) / 2, MOVERS.z + (s.n % 2 ? -2.5 : 2.5), size, String(s.n), '#fff', 7, 'step'); tag(...AT[s.n - 1], SHORT[s.n - 1], 5.2); }
  tag(-70, -84, 'START · PB', 5.6, '#0a6b78');
  // grapple course
  tag(G0.start[0] + 1, G0.start[1] - 8, 'GRAPPLE START · PB', 5.4, '#0a6b78');
  for (const p of G0.poles) tag(p.x + (p.n === 1 ? -11 : 11), p.z, `HOOK ${p.n}<i>${p.h} m pole</i>`, 5.4);
  tag(G0.tank.x - 2, G0.tank.z - 10, 'HOOK 3 · TANK<i>18 m roof</i>', 5.6); tag(G0.mast.x - 13, G0.mast.z + 2, 'HOOK 4<br>MAST<i>28 m</i>', 5.4);
  tag(G0.tower.x, G0.tower.z - 13, 'HOOK 5 · TOWER<i>45 m</i>', 5.6); tag(-178, -22, 'ZIP 99 m → town', 5.4, '#7a1060');
  // climb yard + the Rock
  tag(-167, 15, 'SCRAMBLE WALL', 5.2); for (const d of CLIMB.decks) tag(d.x, d.z + 6, `DECK ${d.id} ${d.h} m<i>ladder</i>`, 5.2);
  tag(-200, 9, 'CAVE (N mouth)', 5.2); tag(-198, 80, 'CAVE (S mouth) · 60 m', 5.2); tag(-206, 33, 'LOOKOUT', 5.6);
  tag(-222, 70, 'SCRAMBLE', 5.2); tag(-226, 22, 'LADDER', 5.2);
  // hover park
  tag(-110, 160, 'TRICK START · PB', 5.6, '#0a6b78'); tag(-134, 125, 'RUN-UP 45 m', 5.4); tag(-166, 162, 'KICKERS ×3<i>1.6 · 2.4 · 3.2 m</i>', 5.4);
  tag(-220, 142, 'HALF-<br>PIPE<i>45 m</i>', 5.4); tag(-145, 220, 'FUNBOX', 5.4); tag(-122, 196, 'QP', 5.4); tag(-168, 196, 'QP', 5.4);
  tag(-198, 178, 'GRIND RAILS ×3', 5.2); tag(-212, 216, 'BOWL', 5.4);
  // range
  ['RIFLE 75 m', 'XBOW+AMMO', 'XBOW', 'BOW', 'BOW'].forEach((t, i) => tag(RANGE.lanes[i].x, RANGE.firingZ + (i % 2 ? 11 : 5), t, 5));
  tag(-72, RANGE.firingZ + 28, 'AMMO 20 m<i>iron · pitch · broadhead</i>', 5); tag(-24, 92, 'SWORD ×3', 5.2); tag(-24, 110, 'SPEAR ×3', 5.2);
  tag(-56, 72, 'PB · firing line', 5.2, '#0a6b78'); tag(-53, 162, 'BERM', 5.4, '#333');
  // physics yard
  tag(-72, 186, 'PLATES ×3 → GATE', 5.4); tag(-71, 218, 'SEE-SAWS', 5.4); tag(-34, 189, 'BALL RUN → SKITTLES', 5.2); tag(-36, 222, 'CRATES', 5.2);
  // vistas, caches, Gold, numbered
  westNo.b.forEach((q, i) => mark(L, q.x, q.z, size, `★${i + 1}`, '#fff', 9));
  westNo.c.forEach((q, i) => mark(L, q.x, q.z, size, `◆${i + 1}`, '#1fd3e8', 9));
  westNo.g.forEach((g, i) => mark(L, g.x + 3, g.z + 3, size, `●${i + 1}`, '#ffd000', 8));
}
function layoutCanvas(w, h, top) { renderer.setSize(w, h); renderer.domElement.style.top = top + 'px'; }
let current = null;
function render(cam) { if (cam === persp) persp.updateProjectionMatrix(); renderer.render(scene, cam); }
const B_ = budget(), G_ = grind(P), S_ = onScreen(P), R2_ = coverReach(P), R1_ = coverReach(P, false), W_ = westWalks();
const sw = c => `<span class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></span>`;
const SVC = [...HUB.services, ...HUB.npcs];
const townSpan = (() => { let m = 0; for (const a of SVC) for (const b of SVC) m = Math.max(m, Math.hypot(a.x - b.x, a.z - b.z)); return m; })();
const houses = TOWN_B.filter(b => b.kind === 'house').length;
function townSvg() {   // the town inset: every building, the plaza, the services and the gates
  const k = 128 / 124, P2 = (x, z) => [(x - TOWN.x0 + 2) * k, (z - TOWN.z0 + 2) * k];
  const el = [`<svg width="130" height="140" viewBox="0 0 130 140"><rect x="0" y="0" width="130" height="130" fill="#c9c0ad"/>`];
  const r = (x0, x1, z0, z1, f) => { const [a, b] = P2(x0, z0), [c, d] = P2(x1, z1); el.push(`<rect x="${a.toFixed(1)}" y="${b.toFixed(1)}" width="${(c - a).toFixed(1)}" height="${(d - b).toFixed(1)}" fill="${f}"/>`); };
  r(PLAZA.x0, TOWN.x1, PLAZA.z0, PLAZA.z1, '#eeeeee');
  for (const b of TOWN_B) r(b.x0, b.x1, b.z0, b.z1, b.kind === 'house' ? '#8f9499' : b.kind === 'shop' ? '#e2782c' : b.kind === 'tolet' ? '#5a5f65' : b.kind === 'zip' ? '#2fbfd3' : b.kind === 'stable' ? '#a3957f' : '#b85d1e');
  for (const s of HUB.services.filter(q => !q.shop)) { const [x, y] = P2(s.x, s.z); el.push(`<rect x="${x - 3}" y="${y - 1.5}" width="6" height="3" fill="#e2782c"/>`); }
  for (const n of HUB.npcs) { const [x, y] = P2(n.x, n.z); el.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="${n.giver ? '#ffd23a' : '#1fd3e8'}" stroke="#111" stroke-width=".6"/>`); }
  for (const g of GATES) { const [x, y] = P2(g.x, g.z); el.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="#b85d1e" stroke-width="1.4"/>`); }
  const t = (x, z, s) => { const [a, b] = P2(x, z); el.push(`<text x="${a}" y="${b}" font-size="5.6" text-anchor="middle" fill="#111" font-weight="700">${s}</text>`); };
  t(-36, 6, 'PLAZA'); t(-65, -24, 'ROOK'); t(-65, 28, 'WEAPONS'); t(-115, -30, 'ZIP'); t(-19, -30, 'STABLE'); t(-112, 3, 'MAIN ST');
  el.push(`<text x="2" y="138" font-size="6.6" fill="#fff">120×120 m · ${houses} houses · services ≤ ${Math.round(townSpan)} m apart</text></svg>`);
  return el.join('');
}
const gTot = G_.reduce((a, g) => a + g.hours, 0);
const R3_WEST = { '01': 30976, '02': 7500, '03': 0, '04': 16642, 'MP': 1920, '05': 2112 + 908, '06': 576, '10': 0, 'H': 2760, '11': 12600 };
const VIEWS = {
  plan() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 4 · 500 m CELL · TOP-DOWN PLAN</b><span>North up. Only the WEST changed: the town is 120 m (was 176) and every toy has its own labelled footprint. East = round 3. ! quest · ✦ beacon · ★ vista · ◆ cache · ● Gold 1×1 · ⛩ town gate · magenta = grapple route, blue = movers run.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'plan');
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>IT FITS: town ${(B_.town / 2500).toFixed(1)} % of the cell (was 12.4), west toys ${((B_.west + B_.cand) / 2500).toFixed(1)} % (was 18.0), ${(B_.free / 2500).toFixed(1)} % still free</h3>
      <table><tr><td style="width:132px">${townSvg()}</td><td>
      <b>The town, 120 m</b>: the 40 m <b>gate plaza</b> inside the east gate (quest board with G1 Yard Boss L1–6, G2 Surveyor L7–12, G3 Shift Boss L13–20; contracts, trophy wall, feats, stalls, the 22 m obelisk) and a 72 m <b>Main Street</b>: Tinker Rook, the weapons shop and its keeper, three empty fronts, the zip house. The stable and the stable hand sit inside the Stable Gate. Six gates, each toward its toys; only the <b>east</b> one crosses into combat.</td></tr></table>
      <b>West toys, each its own footprint</b>: 02 range (dummies, bow, crossbow + ammo, rifle to 75 m) · 03 physics yard (plates, crates, see-saws, balls) · 04 riding course + paddock · 05 movers sequence (six numbered stations) · 06 grapple course (start, hooks 1–5, 99 m zip to the finish in town) · 10 climb yard (ladders, scramble, bridges) · the Rock (squeeze cave, lookout) · 11 hover park. Every course has a personal-best board at its start. Walks from the quest corner: ${Math.min(...W_.map(w => w.walk))}–${Math.max(...W_.map(w => w.walk))} s.`;
    render(ortho);
  },
  westplan() {
    const W = VW(), H = VH(); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 4 · THE WEST, CLOSE UP · every item labelled</b><span>North up. Town 120 m (was 176). PB = personal-best board. Magenta = grapple course (dashed = zip), blue = movers run, brown dashed = rope bridges.</span>';
    $('foot').hidden = false; $('foot').innerHTML = '★1–6 vistas (★1 Rock lookout, ★2 tank roof, ★3 tower top, ★4 NW corner, ★5 SW corner, ★6 east gatehouse) · ◆1–4 caches · ●1–10 west Gold 1×1 · ⛩ town gates · ● yellow = quest givers, cyan = other NPCs · <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:#c3249b"></span> movers stations 1–6';
    const top = $('cap').offsetHeight, fh = $('foot').offsetHeight, h = H - top - fh, z0 = -248, z1 = 248, w = Math.min(W, Math.round(h * 261 / (z1 - z0)));
    const x0 = -252, x1 = x0 + w / h * (z1 - z0);
    setFrame(x0, x1, z0, z1); layoutCanvas(w, h, top); renderer.domElement.style.left = (W - w) / 2 + 'px'; $('labels').style.left = (W - w) / 2 + 'px';
    westLabels([w, h], top); $('panel').hidden = true;
    render(ortho);
  },
  budget() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = false; budgetOnly.visible = true; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 4 · AREA BUDGET (used vs free)</b><span>Blue = the town · orange = west toys · teal = paddock · yellow→red = level bands · maroon = combat set pieces · slate = roads · bare grid = free. Round 3 in brackets. East unchanged.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'budget');
    const pct = n => (n / 2500).toFixed(1) + ' %';
    $('panel').hidden = false; $('foot').hidden = true;
    const wz = ZONES.filter(z => WEST_IDS.has(z.id));
    $('panel').innerHTML = `<table style="font-size:8.6px"><tr><td style="vertical-align:top;width:52%"><table>
      <tr><td>${sw(KIND.town)}Town</td><td class="num">${fmt(B_.town)}</td><td class="num">${pct(B_.town)}</td><td class="num">(12.4)</td></tr>
      <tr><td>${sw(KIND.west)}West toys</td><td class="num">${fmt(B_.west)}</td><td class="num">${pct(B_.west)}</td><td class="num">(16.1)</td></tr>
      <tr><td>${sw(KIND.cand)}Paddock</td><td class="num">${fmt(B_.cand)}</td><td class="num">${pct(B_.cand)}</td><td class="num">(1.9)</td></tr>
      <tr><td>${sw(KIND.band)}East bands</td><td class="num">${fmt(B_.band)}</td><td class="num">${pct(B_.band)}</td><td class="num">(26.6)</td></tr>
      <tr><td>${sw(KIND.set)}East set pieces</td><td class="num">${fmt(B_.set)}</td><td class="num">${pct(B_.set)}</td><td class="num">(9.1)</td></tr>
      <tr><td>${sw(0x3c4148)}Roads, strip</td><td class="num">${fmt(B_.circ)}</td><td class="num">${pct(B_.circ)}</td><td class="num">(14.9)</td></tr>
      <tr><td>${sw(0xc3c6c9)}<b>Free</b></td><td class="num"><b>${fmt(B_.free)}</b></td><td class="num"><b>${pct(B_.free)}</b></td><td class="num">(19.0)</td></tr></table>
      <h3>WALKS from the quest corner</h3><table>${W_.map(w => `<tr><td>${w.to}</td><td class="num">${w.m} m</td><td class="num">${w.walk} s</td><td class="num">${w.sprint} s</td></tr>`).join('')}</table>
      <span style="color:#aaa">walk 4.3 m/s · sprint 7.2 m/s · through the gates</span></td>
      <td style="vertical-align:top"><h3>WEST ZONES, m² (round 3)</h3><table>${wz.map(z => `<tr><td>${z.id} ${z.name.toLowerCase()}</td><td class="num">${fmt(zoneArea(z))}</td><td class="num">(${R3_WEST[z.id] ? fmt(R3_WEST[z.id]) : 'new'})</td></tr>`).join('')}
      <tr><td><b>west total</b></td><td class="num"><b>${fmt(wz.reduce((a, z) => a + zoneArea(z), 0))}</b></td><td class="num">(${fmt(Object.values(R3_WEST).reduce((a, b) => a + b, 0))})</td></tr></table>
      <span style="color:#aaa">Round 3's physics + hover (12,600) split into the hover park and the physics yard; the tank and tower joined the grapple course; the movers were a 48×44 spiral.</span></td></tr></table>`;
    render(ortho);
  },
  aerial() { full(); signScale(.62); persp.near = 2; persp.fov = 68; persp.position.set(-500, 540, 300); persp.lookAt(-100, 0, 10); persp.updateProjectionMatrix(); for (const sp of signList) { const p = new THREE.Vector3(); sp.getWorldPosition(p); sp.visible = p.x < 0 && /^(0\d|1\d) |^THE ROCK|^PADDOCK/.test(sp.userData.text ?? ''); } caption('AERIAL · round 4 · the west from the south-west, 540 m up', `North is up and left. The 120 m town (${houses} houses) sits against the seam; every toy has its own ground round it: riding course, movers and grapple course to the north, climb yard and the Rock in the middle, hover park, range and physics yard to the south. The combat half is beyond, unchanged.`); render(persp); },
  gate() { full(); persp.fov = 80; persp.position.set(-16, EYE, 10); persp.lookAt(-46, 5, -20); signsWithin(45); caption('GROUND VIEW · TOWN · THE GATE PLAZA · eye 1.7 m', 'Just inside the east gate: the quest board with its three tier givers (yellow ! = a level 1 may take it, grey = locked) and the 22 m obelisk at the head of Main Street, with Tinker Rook\'s awning behind. The plaza is 40 m now; the board is 30 m from the gate.'); render(persp); },
  street() { full(); persp.fov = 66; persp.position.set(-104, EYE, 1.5); persp.lookAt(-40, 4, 0); signsWithin(75); caption('GROUND VIEW · TOWN · MAIN STREET (THE SHOP ROW)', 'From the cross lane looking east: two TO LET fronts, then Tinker Rook (left) and the weapons shop (right) with their keepers, the obelisk closing the street and the plaza beyond. 72 m from the West Gate to the plaza.'); render(persp); },
  range() { full(); persp.fov = 80; persp.position.set(-37, EYE, 72); persp.lookAt(-80, 1.2, 125); signsWithin(70); caption('GROUND VIEW · 02 WEAPON RANGE · on the firing line', 'Behind the firing line at its east end, looking across the lanes: targets every 10 m to 50 m (bow, crossbow), the crossbow ammo practice at 20 m (plank, burning bale, soft dummy), the rifle lane to 75 m on the far right, the berm behind. The sword and spear dummies are in the melee yard just off the left edge.'); render(persp); },
  hover() { full(); persp.fov = 66; persp.position.set(-114, EYE, 147); persp.lookAt(-200, 3, 140); signsWithin(130); caption('GROUND VIEW · 11 HOVER PARK · from the trick-score start', 'Just off the start pad: the three cyan run-up lanes (45 m) into the kickers (1.6, 2.4, 3.2 m) and the 45 m halfpipe straight beyond them; quarter pipes, funbox, rails and the bowl lie to the left. Hover only: the physics toys moved to their own yard.'); render(persp); },
  movers() { full(); persp.fov = 80; persp.position.set(-60, EYE, -66); persp.lookAt(-110, 6, -100); signsWithin(120); caption('GROUND VIEW · 05 MOVERS SEQUENCE · from its south-east corner', 'The whole run read right to left, rising: start pad and PB board, 1 conveyors, 2 jump pads up to the 6 m ledge, 3 sliding platforms over the pit, 4 the spinner, 5 the lift to 18 m, 6 the top deck and its rope bridge onto the water tank (left), where the timer stops.'); render(persp); },
  grapple() { full(); persp.fov = 88; persp.position.set(-134, EYE, 4); persp.lookAt(-167, 16, -34); signsWithin(150); caption('GROUND VIEW · 06 GRAPPLE COURSE · outside the West Gate', 'The start pad and PB board; hook poles 1 and 2, the water tank (hook 3), the mast (hook 4) and the 45 m tower (hook 5). The zipline runs 99 m from the tower top back over the town wall to the finish on the zip-house roof. Every hop ≤ 38 m.'); render(persp); },
  riding() { full(); persp.fov = 66; persp.position.set(-52, EYE + .9, -149); persp.lookAt(-130, 3, -148); signsWithin(100); caption('GROUND VIEW · 04 RIDING COURSE · the start (horseback eye 2.6 m)', 'Out of the paddock chute onto the south straight: the start/finish gantry with the lap timer and the PB board beside it, rings down the straight and round the turns, jumps on the far straight. 479 m lap, 37 s at gallop.'); render(persp); },
  rock() { full(); persp.fov = 70; persp.position.set(-204, EYE, 112); persp.lookAt(-210, 7, 50); signsWithin(90); caption('GROUND VIEW · THE ROCK · from the hover park side', 'The 16 m crag on its own ground west of the town: the squeeze cave\'s south mouth (60 m through to the west avenue), the scramble route up the south face on the left, the lookout bench on top and the climb yard\'s last rope bridge landing on it from the right.'); render(persp); },
  compare() {
    const W = VW(); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 3 → ROUND 4 · the west, same scale, north up</b><span>Left: round 3 (c292cc13e6). Right: round 4. Town 176 → 120 m; the freed ground goes to the toys, each its own footprint.</span>';
    const top = $('cap').offsetHeight, s = Math.floor(W / 2);
    const r1 = $('r1'); r1.hidden = false; Object.assign(r1.style, { top: top + 'px', width: s + 'px', height: 2 * s + 'px', left: '0px', backgroundSize: `${2 * s}px ${2 * s * 874 / 402}px`, backgroundPosition: `0 -${2 * s * 77 / 402}px` });
    setFrame(-262, 0, -262, 262); layoutCanvas(s, 2 * s, top); renderer.domElement.style.left = s + 'px'; planLabels([s, 2 * s], top, 'cmp'); $('labels').style.left = s + 'px';
    for (const [id, x, t] of [['t1', 4, 'ROUND 3'], ['t2', s + 4, 'ROUND 4']]) { const d = $(id); d.hidden = false; d.textContent = t; d.style.top = top + 4 + 'px'; d.style.left = x + 'px'; }
    const wz = ZONES.filter(z => WEST_IDS.has(z.id));
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>WHAT MOVED (m², round 3 → round 4)</h3><table>${wz.map(z => `<tr><td>${z.id} ${z.name.toLowerCase()}</td><td class="num">${R3_WEST[z.id] ? fmt(R3_WEST[z.id]) : '—'}</td><td class="num">→ <b>${fmt(zoneArea(z))}</b></td></tr>`).join('')}</table>
      Town −${fmt(R3_WEST['01'] - zoneArea(ZONES[0]))} m². Toys +${fmt(wz.filter(z => z.id !== '01').reduce((a, z) => a + zoneArea(z) - (R3_WEST[z.id] ?? 0), 0))} m²: the movers became a straight six-station run, the tank and tower a timed grapple course, physics got its own yard, the hover park grew, the climb yard is new and the Rock stands on its own. Free floor ${(B_.free / 2500).toFixed(1)} % (was 19.0 %).`;
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
  $('foot').hidden = false; $('foot').textContent = 'Showcase Template · round 4 grey blockout · art/showcase-template/round-4-blockout · labels are burned in';
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
// A free camera for clean grey frames (round-11 remaster inputs): no caption, no labels, no signs unless asked.
//   lab.cam({ pos: [x, y, z], look: [x, y, z], fov: 70, signs: false })
function cam({ pos, look, fov = 70, signs: withSigns = false }) {
  current = 'cam'; controls.enabled = false; full(); signs.visible = withSigns;
  for (const id of ['cap', 'foot', 'panel', 'ui']) $(id).style.display = 'none';
  persp.fov = fov; persp.near = .2; persp.position.set(...pos); persp.lookAt(...look); render(persp);
}
window.lab = { show: n => { for (const id of ['cap', 'foot', 'panel', 'ui']) $(id).style.display = ''; ui.value = n; show(n); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
  cam: o => { cam(o); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
  topdown: (x0, x1, z0, z1) => { current = 'cam'; for (const id of ['cap', 'foot', 'panel', 'ui']) $(id).style.display = 'none';
    signs.visible = false; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null; $('labels').innerHTML = '';
    setFrame(x0, x1, z0, z1); layoutCanvas(VW(), VH(), 0); render(ortho); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
  stats: () => ({ budget: B_, fit: P.fit, grind: G_, onScreen: S_, reach: [R2_, R1_], townSpan, houses, townBuildings: TOWN_B.length, cover: P.cover.length, chests: P.chests.length, crates: P.crates.length, quests: P.quests.length, lairs: P.lairs, packs: P.packs.length,
    night: P.packs.filter(p => p.night).length, walks: W_ }) };
window.labReady = true;
