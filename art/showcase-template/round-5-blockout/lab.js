// Showcase Template grey blockout lab, ROUND 5: builds the measured layout in layout.js as dev-map blocks and frames the
// captures (plan board, budget board, aerial, ground views at 1.7 m eye height). window.lab.show(name) for capture.mjs.
// R3 (Jake 11-03): the hub is a walled town on the west; NE = bands 1-4; SE = bands 5-6 over the gauntlet and the Titan.
// R4 (Jake 11-03, "that town might be a little bit too big"): the town shrinks to 120 m and every west toy gets its own
// labelled footprint. The east is round 3's, untouched.
// R5 (Jake 11-03, "like Elden Ring or Dark Souls, there needs to be a boss portal"): only the SE bottom and the hidden
// layers change. The Titan amphitheatre becomes a small surface Titan gate with a portal into a hidden arena at y -150;
// the gauntlet takes the freed ground as three sealed courts through three gates. Everything else is round 4's.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { REAL, HALF, STRIP, AVENUE_HALF, TOWN, PLAZA, ROAD, SEAM_X, GATES, ROAD_GATES, SE_WALL, ZONES, INTERIORS, SECRETS, HUB,
  BEACONS, BANDS, GATE_ELITES, ELITES, ELITE_LAIR_R, LOOKOUT, GOLD, GRIND, CONTRACTS, ARCHES,
  STREETS, BLOCKS, RANGE, MOVERS, GRAPPLE, CLIMB, ROCK, HOVER, PHYSICS, PADDOCK, RIDING, WALKS,
  SE_BOTTOM, R4_SE, TITAN_ROAD, GAUNTLET, TITAN_GATE, TITAN, TITAN_ARENA, LAYERS } from './layout.js';
import { place as placeContent, budget, inZone, zoneArea, coverReach, grind, onScreen, westWalks,
  gauntletFit, gauntletView, titanScales, layerCheck, seLedger, titanArenaArea } from './placement.js';


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
// ---------- round 3 builders ----------
const P = placeContent();
const fmt = n => Math.round(n).toLocaleString('en-US');
const cobble = mat(0xd3cbb9), street = mat(0xa79f8f), wallC = mat(0xcf8a52);
function zoneDims(zn) {
  if (zn.dims) return zn.dims;
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
// ---------- R5: the SE bottom ----------
const zoneById = id => ZONES.find(z => z.id === id);
// an axis-aligned wall from (x0, z0) to (x1, z1) with gaps [[centre along the wall, width]]
function wallLine(x0, z0, x1, z1, h, gaps = [], m = M.orange, t = 1) {
  const horiz = z0 === z1, a0 = horiz ? Math.min(x0, x1) : Math.min(z0, z1), a1 = horiz ? Math.max(x0, x1) : Math.max(z0, z1);
  let a = a0;
  for (const [c, w] of [...gaps].sort((p, q) => p[0] - q[0]).concat([[a1 + 1e6, 0]])) {
    const b = Math.min(c - w / 2, a1);
    if (b > a + .01) { if (horiz) box(b - a, h, t, (a + b) / 2, 0, z0, m); else box(t, h, b - a, x0, 0, (a + b) / 2, m); }
    a = Math.max(a, c + w / 2); if (a >= a1) break;
  }
}
function gateFrame(x, z, w, ry, label, sub, h = 7) {
  place(() => { for (const s of [-1, 1]) box(1.4, h, 1.4, s * (w / 2 + .7), 0, 0, M.orangeDark); box(w + 2.8, 1.2, 1.4, 0, h, 0, M.orangeDark); box(w, .25, .3, 0, h - .6, 0, M.hazard, { edges: false }); }, x, z, ry);
  sign(label, sub, x, h + 4, z, 14);
}
function stake(x, z, y = 0, sub = 'respawn point') {
  box(.5, 2.4, .5, x, y, z, M.dark); add(new THREE.SphereGeometry(.55, 12, 8), M.glow, x, y + 2.8, z); flatDisc(x, z, 2.4, y + .06, M.cyan, 1.8);
  sign('CHECKPOINT', sub, x, y + 6, z, 12);
}
function lift(o, y) { o.position.y += y; return o; }
function gCover([k, x, z, ry]) {
  if (k === 'half') place(() => box(6, 1.1, .8, 0, 0, 0, M.orange), x, z, ry);
  if (k === 'crates') place(() => { box(2, 2, 2, -1, 0, 0, M.orange); box(2, 2, 2, 1.1, 0, .3, M.orangeDark); box(2, 1.2, 2, 0, 2, 0, M.orange); }, x, z, ry);
  if (k === 'pillar') box(2.2, 6, 2.2, x, 0, z, M.grey);
}
function buildGauntletR5() {
  const G = GAUNTLET, F = zoneById('08F');
  flatRect(F.x0, F.x1, F.z0, F.z1, .045, M.light);
  stake(...G.checkpoint, 0, 'the gauntlet + the Titan road');
  box(9, 4, .5, G.board[0], .8, G.board[1], M.cyan); for (const s of [-1, 1]) box(.3, .8, .3, G.board[0] + s * 4, 0, G.board[1], M.dark, { edges: false });
  sign('RUN BOARD', '5 waves · 3 courts · best time', G.board[0], 8, G.board[1], 14);
  sign('GAUNTLET FORECOURT', 'both SE-wall gates · checkpoint', 80, 13, 135, 24);
  // C1: entry ramp up from the forecourt onto the +3 m terrace, the floor below
  const [c1, c2, c3] = G.courts;
  wedge(10, 3, 8, G.entry.x, G.entry.z - 5, -Math.PI / 2, M.light);
  for (const c of [c1, c2]) {
    flatRect(c.floor[0], c.floor[1], c.floor[2], c.floor[3], .05, M.dirt);
    for (const st of c.steps) { const [x0, x1, z0, z1] = st.box; box(x1 - x0, st.y, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, M.light); }
    for (const [x, z] of c.ramps) { const y = c.steps[0].y, len = y * 3.4; wedge(len, y, 7, x, c.steps[0].box[3] + len / 2, Math.PI / 2, M.light); }
  }
  // court walls with the entry, the gates, and the spawn doors
  const D = id => G.doors.find(d => d.id === id), dg = d => [d.z, 5];
  wallLine(14, 142, 96, 142, c1.wallH, [[G.entry.x, 8]]); wallLine(14, 184, 96, 184, c1.wallH, [[G.gates[0].x, G.gates[0].w]]);
  wallLine(14, 142, 14, 184, c1.wallH, [dg(D('D1'))]); wallLine(96, 142, 96, 184, c1.wallH, [dg(D('D2'))]);
  wallLine(14, 190, 96, 190, c2.wallH, [[G.gates[0].x, G.gates[0].w]]); wallLine(14, 234, 96, 234, c2.wallH);
  wallLine(14, 190, 14, 234, c2.wallH, [dg(D('D3'))]); wallLine(96, 190, 96, 234, c2.wallH, [[G.gates[1].z, G.gates[1].w], dg(D('D4'))]);
  // G1 is a ramp up from C1's floor to C2's ledge; G2 and G3 are level passages
  wedge(6, 2.5, 10, G.gates[0].x, 187, -Math.PI / 2, M.light);
  for (const g of G.gates.slice(1)) { const [x0, x1, z0, z1] = g.passage; flatRect(x0, x1, z0, z1, .05, M.light); }
  wallLine(96, 210, 114, 210, 4, [], M.orange, .8); wallLine(96, 218, 114, 218, 4, [], M.orange, .8);
  wallLine(188, 182, 208, 182, 4, [], M.orange, .8); wallLine(188, 190, 208, 190, 4, [], M.orange, .8);
  // C3: the Foreman's floor: floor, two terraces and the 6 m wall in one lathe, cut by G2, G3 and the doors D5, D6
  const d = c3.disc, ang = (x, z) => Math.atan2(-(z - d.z), x - d.x);
  flatDisc(d.x, d.z, d.floor, .05, M.dirt);
  ringWall(d.x, d.z, [[d.floor, 0], [d.floor, 1.5], [d.t1, 1.5], [d.t1, 3], [d.t2, 3], [d.t2, c3.wallH], [d.wall, c3.wallH], [d.wall, 0]], M.orange,
    [[ang(G.gates[1].passage[1], G.gates[1].z), .24], [ang(G.gates[2].passage[0], G.gates[2].z), .22], [Math.PI / 2, .16], [-Math.PI / 2, .16]]);
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {   // stairs: floor -> +1.5 -> +3
    const c = Math.cos(a), sn = -Math.sin(a);
    wedge(5, 1.5, 4, d.x + c * (d.floor - 2.5), d.z + sn * (d.floor - 2.5), a, M.light);
    lift(wedge(5, 1.5, 4, d.x + c * (d.t1 - 2.5), d.z + sn * (d.t1 - 2.5), a, M.light), 1.5);
  }
  // spawn doors: a frame in the wall, a closet behind it
  for (const dr of G.doors) {
    const [x0, x1, z0, z1] = dr.closet; box(x1 - x0, 4.2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, M.dark);
    box(dr.court === 'C3' ? 4 : 1.2, 3.6, dr.court === 'C3' ? 1.2 : 4, dr.x, 0, dr.z, M.hazard, { edges: false });
    sign(dr.id + ' · SPAWN DOOR', dr.court, dr.x, 7.5, dr.z, 10);
  }
  // the gates of the run
  gateFrame(G.gates[0].x, G.gates[0].z, G.gates[0].w, 0, 'G1', 'opens after wave 2 · up to C2', 8);
  gateFrame(G.gates[1].x, G.gates[1].z, G.gates[1].w, Math.PI / 2, 'G2', 'opens after wave 4 · into C3');
  gateFrame(G.gates[2].x, G.gates[2].z, G.gates[2].w, Math.PI / 2, 'G3', 'opens after wave 5 · the Titan gate');
  gateFrame(G.entry.x, G.entry.z, 8, 0, 'ENTRY', 'seals when wave 1 starts', 8);
  for (const c of G.cover) gCover(c);
  // C2's elite reveal lift and banner
  const R = G.reveal;
  box(R.size, R.rise, R.size, R.x, 0, R.z, M.cyan); box(R.size + 1, .3, R.size + 1, R.x, R.rise, R.z, M.orangeDark);
  lift(capsule(R.x, R.z, 3.4, .9, M.elite), R.rise + .3); box(8, 5, .2, R.x, R.rise + 4, R.z + 3.4, M.elite, { edges: false });
  sign('ELITE REVEAL LIFT', 'wave 3 · a named elite rises +4 m', R.x, R.rise + 13, R.z, 18);
  // the Foreman's office and balcony over C3's north-east wall
  const B = G.balcony, [ox0, ox1, oz0, oz1] = B.office;
  box(ox1 - ox0, 8, oz1 - oz0, (ox0 + ox1) / 2, 0, (oz0 + oz1) / 2, M.grey); box(ox1 - ox0 + 1, .5, oz1 - oz0 + 1, (ox0 + ox1) / 2, 8, (oz0 + oz1) / 2, M.orangeDark);
  place(() => { box(7, .5, 5, 0, B.y, 0, M.orangeDark); box(7, 1.1, .2, 0, B.y + .5, 2.4, M.hazard, { edges: false }); }, B.x, B.z, Math.PI / 4);
  lift(capsule(B.x, B.z, 3.4, .9, M.elite), B.y + .5); box(1.2, .5, 1.2, B.x, B.y + 4, B.z, M.glow);
  sign("FOREMAN'S BALCONY", 'Foreman Unit 7 · L18 · drops in for wave 5', B.x, B.y + 12, B.z, 20);
  box(1.6, 1.1, 1, G.trophy.x, 0, G.trophy.z, M.glow); sign("FOREMAN'S TROPHY", 'chest after wave 5', G.trophy.x, 4, G.trophy.z, 12);
  // a wave in each court, for the eye-height frames
  for (const [k, x, z] of [['Riveter', 42, 166], ['Riveter', 66, 170], ['Riveter', 50, 178], ['Riveter', 78, 176], ['Arc Sentry', 22, 167], ['Arc Sentry', 89, 168],
    ['Riveter', 36, 222], ['Riveter', 70, 224], ['Riveter', 28, 206], ['Arc Sentry', 86, 210], ['Arc Sentry', 22, 228],
    ['Crate Mite', 140, 180], ['Crate Mite', 150, 192], ['Crate Mite', 156, 182], ['Pallet Jack', 132, 192], ['Arc Sentry', 160, 200]]) enemy(k, x, z, false);
  sign('C1 · LOADING YARD', 'waves 1–2 · L16–17 · floor 82 × 34 m', 55, 16, 170, 26);
  sign('C2 · THE PIT', 'waves 3–4 · L17–18 · floor 82 × 37 m', 55, 16, 214, 26);
  sign("C3 · FOREMAN'S FLOOR", 'wave 5 · ⌀56 floor · terraces +1.5 / +3 m', d.x, 20, d.z, 30);
}
function buildTitanGate() {
  const T = TITAN_GATE, [lx0, lx1, lz0, lz1] = T.lane, [px0, px1, pz0, pz1] = T.plaza, A = T.arch;
  flatRect(TITAN_ROAD.x0, TITAN_ROAD.x1, TITAN_ROAD.z0, TITAN_ROAD.z1, .035, M.asphalt);
  sign('TITAN ROAD', 'forecourt → the Titan gate', 168, 7, 130, 16);
  flatRect(lx0, lx1, lz0, lz1, .045, M.light); flatRect(px0, px1, pz0, pz1, .045, M.light);
  wallLine(lx0, lz0, lx0, lz1, 4, [[186, 8]], M.orangeDark, 1.5); wallLine(lx1, lz0, lx1, lz1, 4, [], M.orangeDark, 1.5);
  wallLine(px0, pz0, px0, pz1, 5); wallLine(px1, pz0, px1, pz1, 5); wallLine(px0, pz1, px1, pz1, 5); wallLine(px0, pz0, px1, pz0, 5, [[(lx0 + lx1) / 2, lx1 - lx0]]);
  // the portal arch: the boss fog
  box(A.w + 8, .6, 7, A.x, 0, A.z - 1.5, M.grey);
  for (const s of [-1, 1]) box(3, A.h, 3, A.x + s * (A.w / 2 + 1.5), 0, A.z, M.orangeDark);
  box(A.w + 6, 3, 3, A.x, A.h - 3, A.z, M.orangeDark);
  add(new THREE.TorusGeometry(A.portalR, .6, 10, 48), M.portal, A.x, A.portalR + 1.2, A.z - .5);
  add(new THREE.CircleGeometry(A.portalR - .3, 40), M.portal, A.x, A.portalR + 1.2, A.z - .7, { ry: Math.PI, shadow: false });
  sign('TITAN PORTAL', 'into the hidden arena · y −150', A.x, A.h + 5, A.z, 22);
  stake(...T.stake, 0, 'the last camp · L20');
  box(5, 2.6, .4, T.plaque[0], 0, T.plaque[1], M.white);
  sign('THE CRATE TITAN · L20', 'THE LAST CONTRACT', T.plaque[0], 6, T.plaque[1], 16);
  flatDisc(T.returnPad[0], T.returnPad[1], 3, .07, M.portal); sign('RETURN PAD', 'you come back out here', T.returnPad[0], 5, T.returnPad[1], 12);
  sign('TITAN GATE', '14 m lane · 39 × 38 m plaza', 215, 12, 168, 20);
}
// ---------- R5: the hidden layer ----------
const hiddenG = new THREE.Group(); scene.add(hiddenG); hiddenG.visible = false;
const arenaOv = new THREE.Group(); scene.add(arenaOv); arenaOv.visible = false;
// a blockout Crate Titan of height H, standing at (x, y, z), facing +z
function titanModel(H, x, y, z, ry = 0, ghost = null) {
  const g = new THREE.Group(), prev = target; target = g; const B = TITAN.body;
  const o = ghost ?? M.orange, d = ghost ?? M.orangeDark, legH = B.leg * H, torsoH = B.torso * H, sw = B.shoulder * H, top = legH + torsoH;
  for (const s of [-1, 1]) { box(.13 * H, legH, .15 * H, s * .11 * H, 0, 0, o); box(.15 * H, .07 * H, .17 * H, s * .11 * H, legH * .42, 0, ghost ?? M.glow); }
  box(.42 * H, .08 * H, .2 * H, 0, legH - .05 * H, 0, ghost ?? M.dark);
  box(.4 * H, torsoH, .28 * H, 0, legH, 0, o);
  add(new THREE.CylinderGeometry(.06 * H, .06 * H, .03 * H, 24), ghost ?? M.glow, 0, legH + torsoH * .6, .15 * H, { rx: Math.PI / 2 });
  for (const s of [-1, 1]) {
    box(.16 * H, .14 * H, .22 * H, s * sw / 2, top - .14 * H, 0, d); box(.1 * H, .07 * H, .12 * H, s * sw / 2, top, 0, o);
    const al = B.armLen * H; box(.1 * H, al, .12 * H, s * (sw / 2 + .02 * H), top - .1 * H - al, 0, o);
    box(B.fist * H, B.fist * H, B.fist * H, s * (sw / 2 + .02 * H), top - .1 * H - al - B.fist * H, .02 * H, d);
  }
  box(.2 * H, B.head * H * .82, .2 * H, 0, top + .04 * H, 0, o); box(.22 * H, .04 * H, .22 * H, 0, top + .04 * H + B.head * H * .82, 0, d);
  for (const s of [-1, 1]) box(.05 * H, .025 * H, .02 * H, s * .05 * H, top + .04 * H + B.head * H * .5, .1 * H, ghost ?? M.glow, { edges: false });
  g.position.set(x, y, z); g.rotation.y = ry; (prev === hiddenG ? hiddenG : prev).add(g); target = prev; return g;
}
function buildTitanArena() {
  const A = TITAN_ARENA, X = A.cx, Z = A.cz, Y = A.y, prev = target; target = hiddenG;
  cyl(A.standsR + 2, A.standsR + 2, A.slab, X, Y - A.slab, Z, M.dark, { seg: 64, shadow: false });
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(A.floorR / 5, A.floorR / 5);
  const fl = new THREE.CircleGeometry(A.floorR, 96); fl.rotateX(-Math.PI / 2); add(fl, new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), X, Y + .01, Z, { shadow: false });
  const south = -Math.PI / 2;
  ringWall(X, Z, [[A.floorR, Y], [A.floorR, Y + A.wallH], [A.wallR, Y + A.wallH], [A.wallR, Y]], M.orange, [[south, 18 / A.floorR]]);
  ringWall(X, Z, [[A.wallR, Y], [A.wallR, Y + A.wallH], [A.standsR, Y + A.standsH], [A.standsR, Y]], M.grey, [[south, 18 / A.wallR]]);
  for (let r = A.wallR + 3; r < A.standsR; r += 3.5) {   // seat rows
    const g = new THREE.RingGeometry(r - .25, r + .25, 96, 1, -Math.PI / 2 + .2, 2 * Math.PI - .4); g.rotateX(-Math.PI / 2);
    add(g, M.dark, X, Y + A.wallH + (r - A.wallR) / (A.standsR - A.wallR) * (A.standsH - A.wallH) + .15, Z, { shadow: false, ry: 0 });
  }
  for (const a of A.lanes) {   // P3: the rolling lanes for the 4 x 8 block (10 m wide)
    const g = new THREE.PlaneGeometry(A.floorR - 8, 10); g.rotateX(-Math.PI / 2);
    add(g, new THREE.MeshBasicMaterial({ color: 0xc8463c, transparent: true, opacity: .28, depthWrite: false }), X + Math.cos(a) * (A.floorR / 2 + 4), Y + .05, Z - Math.sin(a) * (A.floorR / 2 + 4), { ry: a, shadow: false });
  }
  flatDisc(X, Z, A.leapBand[1], Y + .06, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: .14, depthWrite: false }), A.leapBand[0]);
  for (const c of A.cover) place2(() => { box(3, 3, 3, -1.6, 0, 0, M.orange); box(3, 3, 3, 1.6, 0, .4, M.orangeDark); box(3, 2, 3, 0, 3, 0, M.orange); }, X + Math.cos(c.a) * c.r, Y, Z - Math.sin(c.a) * c.r, c.a);
  for (const [dx, dz] of [[-14, 6], [10, -18], [22, 10], [-24, -12], [-6, 28]]) flatDisc(X + dx, Z + dz, 2.6, Y + .07, M.hazard, 1.9);   // crate rain rings
  for (const a of A.lanes) { const r = A.standsR - 4; box(2, 46, 2, X + Math.cos(a) * r, Y + 14, Z - Math.sin(a) * r, M.dark); box(6, 3, 2, X + Math.cos(a) * r, Y + 60, Z - Math.sin(a) * r, M.glow, { ry: a + Math.PI / 2 }); }
  // the alcove (south): inner checkpoint, exit portal, the fog gate onto the floor
  const az0 = Z + A.wallR, az1 = Z + A.standsR - 1;
  box(A.alcove.w + 2, .4, az1 - az0, X, Y, (az0 + az1) / 2, M.light);
  for (const s of [-1, 1]) box(1, 9, az1 - az0, X + s * (A.alcove.w / 2 + 1), Y, (az0 + az1) / 2, M.grey);
  box(A.alcove.w + 4, 1, az1 - az0, X, Y + 9, (az0 + az1) / 2, M.dark);
  add(new THREE.TorusGeometry(3.4, .45, 10, 40), M.portal, X + 4, Y + 4.2, az1 - 1.2);
  add(new THREE.CircleGeometry(3.1, 32), M.portal, X + 4, Y + 4.2, az1 - 1.4, { ry: Math.PI, shadow: false });
  stake(X - 4, (az0 + az1) / 2, Y + .4, 'inner · retries start here');
  add(new THREE.PlaneGeometry(A.alcove.w + 2, 8), new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }), X, Y + 4, Z + A.floorR + 1, { shadow: false });
  sign('EXIT PORTAL', '→ the Titan gate', X + 4, Y + 10, az1 - 1, 12);
  sign('FOG GATE', 'onto the floor', X, Y + 7.5, Z + A.floorR + 1, 10);
  // the Titan (chosen height), P2 mites, the 4 x 8 block in the SE lane, a player for scale
  titanModel(TITAN.chosen, X, Y, Z, Math.PI / 4);
  for (const [dx, dz] of [[6, 2], [2, 7], [9, 6], [5, 10]]) { box(.9, .8, .9, X + dx, Y + .05, Z + dz, M.hazard); }
  for (const [dx, dz] of [[13, 6], [5, 14]]) flatDisc(X + dx, Z + dz, 2.6, Y + .07, M.hazard, 1.9);
  lift(capsule(X + 11.3, Z + 11.3, 1.8, .35, M.white), Y);
  const la = A.lanes[3], br = 26; place2(() => box(8, 4, 4, 0, 0, 0, M.orangeDark), X + Math.cos(la) * br, Y, Z - Math.sin(la) * br, la + Math.PI / 2);
  sign('4 × 8 BLOCK', 'P3: rolled down a lane · 1.0 s', X + Math.cos(la) * br, Y + 8, Z - Math.sin(la) * br, 12);
  sign('THE CRATE TITAN · 15 m', 'L20 · P1 Stacked → P2 Unpacked → P3 Overflow', X, Y + 21, Z, 26);
  sign('ROLLING LANES ×4', '10 m wide', X - 30, Y + 5, Z - 24, 12);
  sign('EDGE-LEAP BAND', 'r 40–50 · P3', X - 46, Y + 4, Z + 4, 12);
  target = prev;
}
// like place() but with a base height and into the current target
function place2(fn, x, y, z, ry = 0) { const g = new THREE.Group(), prev = target; target = g; fn(); g.rotation.y = ry; g.position.set(x, y, z); prev.add(g); target = prev; }
function buildVault() {
  const v = ZONES.find(z => z.id === 'TV'), cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
  box(16, 9, 18, cx + 2, 0, cz, M.grey); box(17, .6, 19, cx + 2, 9, cz, M.orangeDark);
  add(new THREE.TorusGeometry(3.6, .5, 10, 40), M.portal, cx - 6.3, 4.2, cz, { ry: Math.PI / 2 });
  add(new THREE.CircleGeometry(3.4, 32), M.portal, cx - 6.2, 4.2, cz, { ry: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) box(2, .3 * (i + 1), 12, cx - 9 - i * 2, 0, cz, M.grey);
  box(.4, 2.6, 5, cx - 8, 0, cz - 8, M.white); sign('4 ROOMS · ELITE · ~10 MIN', 'puzzle · fight · climb · Vault Warden L12', cx - 8, 4, cz - 8, 20);
  sign('TRAINING VAULT', 'the mini dungeon · rooms at y −40', cx, 14, cz, 24);
}
// Round 11 (east remaster): room 4 of the Training Vault, under band 4 at y -40 (INTERIORS: 32 x 32 m, the Vault Warden
// L12, enemies-bosses §4: r 12 m fight ring, sealed door, two wall hatches for the Mites, a 3 m walking vault door with
// clamp arms and a cyan core). Below the cell floor, so no existing view sees it; only lab.cam frames from inside do.
function buildVaultRoom4() {
  const X = 203, Y = -40, Z = -47, S = 32, H = 10;
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(S / 10, S / 10);
  const fl = new THREE.PlaneGeometry(S, S); fl.rotateX(-Math.PI / 2);
  add(fl, new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), X, Y, Z, { shadow: false });
  box(S, H, 1, X, Y, Z - S / 2, M.grey); box(1, H, S, X - S / 2, Y, Z, M.grey); box(1, H, S, X + S / 2, Y, Z, M.grey);
  box(13, H, 1, X - 9.5, Y, Z + S / 2, M.grey); box(13, H, 1, X + 9.5, Y, Z + S / 2, M.grey); box(6, H - 5, 1, X, Y + 5, Z + S / 2, M.grey);
  box(6, 5, .6, X, Y, Z + S / 2 - .2, M.orangeDark);                                    // the sealed door (DG1)
  box(S + 2, 1, S + 2, X, Y + H, Z, M.dark, { shadow: false });                         // ceiling
  flatDisc(X, Z, 12.4, Y + .03, M.hazard, 12);                                          // the r 12 m ring
  for (const s of [-1, 1]) box(.4, 2.4, 2.4, X + s * (S / 2 - .7), Y, Z - 2, M.dark);   // wall hatches
  const wz = Z - 4;                                                                     // the Vault Warden
  box(2.6, 3, 1.2, X, Y, wz, M.elite);
  add(new THREE.CylinderGeometry(1.1, 1.1, .2, 24), M.grey, X, Y + 1.6, wz + .7, { rx: Math.PI / 2 });
  add(new THREE.CylinderGeometry(.45, .45, .25, 16), M.cyan, X, Y + 1.6, wz + .85, { rx: Math.PI / 2 });
  for (const s of [-1, 1]) { box(.5, .5, 1.8, X + s * 1.6, Y + 1.8, wz + .6, M.dark); box(.6, .9, .4, X + s * 1.6, Y + 1.4, wz + 1.6, M.dark); }
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
  sign('SE WALL GATE', 'to the gauntlet forecourt', 62, 7, SE_WALL.z, 14); sign('SE WALL GATE', 'forecourt · the Titan road', 108, 7, SE_WALL.z, 14);
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
buildStealth(); buildGauntletR5(); buildTitanGate(); buildTitanArena();
buildVault(); buildVaultRoom4(); buildEast(); buildSecrets();

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
{ // R5: the SE bottom (dashed orange = what changed), the hidden Titan arena (dashed blue, like the vault), the run
  const line = (pts, color, dashed, y = 64, ds = 4, gs = 3, grp = planOnly) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
    const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: ds, gapSize: gs, depthTest: false }) : new THREE.LineBasicMaterial({ color, depthTest: false }));
    if (dashed) l.computeLineDistances(); l.renderOrder = 14; grp.add(l); return l;
  };
  const S = SE_BOTTOM; line([[S.x0, S.z0], [S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1], [S.x0, S.z0]], 0xff6a00, true, 64, 5, 3);
  const circ = (x, z, r, n = 120) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i / n * 2 * Math.PI) * r, z + Math.sin(i / n * 2 * Math.PI) * r]);
  const A = TITAN_ARENA; line(circ(A.cx, A.cz, A.standsR), 0x1238c8, true, 61, 3, 2); line(circ(A.cx, A.cz, A.floorR), 0x1238c8, true, 61, 1.5, 2.5);
  line([[62, 127], [62, 146], [44, 166], [30, 182], [30, 192], [44, 206], [96, 214], [118, 214], [146, 196], [180, 186], [215, 186], [216, 222]], 0xc3249b, false, 65);
  line([[108, 118], [108, 130], [215, 130], [215, 182]], 0xc3249b, true, 65, 3, 2);
  // arena overlay for the 04 plan: per Titan height, the sweep radius (solid), the closest spot that shows both fists
  // (dashed) and a ~7 H arena (dotted)
  const TS = titanScales();
  TITAN.scales.forEach((H, i) => {
    const T = TS[i], col = [0x2f6fd0, 0xe2782c, 0xc3249b][i], y = TITAN_ARENA.y + 1 + i * .1;
    line(circ(A.cx, A.cz, T.sweepM), col, false, y, 0, 0, arenaOv); line(circ(A.cx, A.cz, T.sweepM + .4), col, false, y, 0, 0, arenaOv);
    line(circ(A.cx, A.cz, T.readM), col, true, y, 2.5, 1.5, arenaOv);
    line(circ(A.cx, A.cz, T.arenaD / 2), col, true, y, .8, 1.6, arenaOv);
  });
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
const OFF = { '08A': [0, 0], '08B': [0, 0], '08C': [-8, 14], '08F': [0, 0], 'TG': [-4, 0], '01': [0, -38], '05': [0, -12], '06': [0, 0], 'K': [0, -22], '09': [0, 10], '08': [0, 0], '11': [0, 0], 'B1': [0, 0], 'B6': [0, -6], 'B4': [-30, 0], 'B5': [0, -38], 'B2': [-22, 34], 'M6': [0, 18], 'TV': [-10, 18], 'MP': [0, 0], 'H': [0, 46], '07': [0, 30], '04': [0, 0], '02': [0, 0], 'B3': [0, 0], '03': [0, 0], '10': [0, 0] };
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
};
const SE_SUB = { '08A': 'waves 1–2 · doors D1 D2', '08B': 'waves 3–4 · elite lift', '08C': 'wave 5 · Foreman Unit 7', '08F': 'checkpoint · run board', 'TG': 'portal → arena y −150' };
const WEST_IDS = new Set(['01', '02', '03', '04', 'MP', '05', '06', '10', 'H', '11']);
function planLabels(size, top, mode) {
  const L = $('labels'); L.innerHTML = ''; L.style.top = top + 'px';
  if (mode !== 'place') for (const zn of ZONES) {
    if (mode === 'cmp' && !WEST_IDS.has(zn.id)) continue;
    const [cx, cz] = zoneCentre(zn), [ox, oz] = OFF[zn.id] ?? [0, 0];
    const [px, pz] = project(cx + ox, cz + oz, size);
    const d = document.createElement('div'); d.className = 'lb ' + (zn.kind === 'cand' ? 'cand' : '');
    d.innerHTML = zn.kind === 'band' ? `${zn.name}<i>${fmt(zoneArea(zn))} m²</i>` : zn.id === 'M6' ? zn.name : `${/^[0-9]/.test(zn.id) ? zn.id + ' ' : ''}${zn.name}<i>${zoneDims(zn)} · ${fmt(zoneArea(zn))} m²</i>${mode === 'plan' && (WEST_SUB[zn.id] ?? SE_SUB[zn.id]) ? `<i>${WEST_SUB[zn.id] ?? SE_SUB[zn.id]}</i>` : ''}`;
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
function panelAt(top) { const p = $('panel'); p.style.top = top + 'px'; p.style.bottom = 'auto'; }
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
// ---------- R5 numbers and label helpers ----------
const GF = gauntletFit(), GV = gauntletView(P), TS = titanScales(), LC = layerCheck(), SE_ = seLedger(), TA = titanArenaArea();
const R4B = { town: 5.8, west: 26.0, cand: 1.2, band: 26.6, set: 9.1, circ: 15.2, free: 16.3 };
const gauntletM2 = ['08A', '08B', '08C', '08F'].reduce((a, id) => a + zoneArea(zoneById(id)), 0);
const tgM2 = zoneArea(zoneById('TG'));
// a label at world (x, z) inside a plan frame fr = [x0, x1, z0, z1] drawn at size [w, h] from `top` px down the page
function tagIn(L, fr, size, top, x, z, html, fs = 6.2, color = '#111', bg = '#ffffffd0') {
  const [w, h] = size, px = (x - fr[0]) / (fr[1] - fr[0]) * w, pz = (z - fr[2]) / (fr[3] - fr[2]) * h;
  if (px < -4 || px > w + 4 || pz < -4 || pz > h + 4) return;
  const d = document.createElement('div'); d.className = 'lb'; d.style.fontSize = fs + 'px'; d.style.color = color;
  if (bg) { d.style.background = bg; d.style.padding = '0 2px'; } d.innerHTML = html; d.style.left = px + 'px'; d.style.top = (top + pz) + 'px'; L.appendChild(d);
}
function stepIn(L, fr, size, top, x, z, text, bg = '#c3249b') {
  const [w, h] = size, d = document.createElement('div'); d.className = 'step'; d.style.background = bg; d.style.width = 'auto'; d.style.padding = '0 3px';
  d.textContent = text; d.style.left = (x - fr[0]) / (fr[1] - fr[0]) * w + 'px'; d.style.top = top + (z - fr[2]) / (fr[3] - fr[2]) * h + 'px'; L.appendChild(d);
}
// every SE-bottom item, labelled on 02 (x, z, html, font px, colour, background)
const TEAL = '#0a6b78', MAG = '#7a1060', DK = '#111';
const SE_TAGS = [
  [44, 119.6, 'BAND 6 · Arc Sentry (unchanged)', 5.2, '#444', ''], [180, 119.6, 'BAND 5 · stealth yard (unchanged)', 5.2, '#444', ''],
  [62, 124.5, 'SE WALL GATE 1', 5.2, '#7a3a0e'], [108, 124.5, 'SE WALL GATE 2', 5.2, '#7a3a0e'],
  [48, 136.5, 'CHECKPOINT', 5.4, TEAL], [86, 136, 'RUN BOARD<i>5 waves · best time</i>', 5.2, TEAL],
  [62, 139.5, 'ENTRY ↑ ramp to +3 m', 5.2, MAG],
  [55, 146, 'ENTRY TERRACE +3 m · 2 ramps down', 5.4], [55, 162, '08A C1 · LOADING YARD<i>82 × 42 m · floor 82 × 34 · waves 1–2</i>', 7.2, DK, '#ffffffe0'],
  [20, 160, 'D1<i>spawn</i>', 5.4, '#8a1020'], [101, 160, 'D2<i>spawn</i>', 5.4, '#8a1020'],
  [34, 172, 'half wall', 4.8, '#444'], [86, 153.5, 'pillar 6 m', 4.8, '#444'], [55, 181, 'crates', 4.8, '#444'],
  [44, 187, 'G1 ↓ ramp up +2.5 m<i>opens after wave 2</i>', 5.2, MAG],
  [70, 193.5, 'ENTRY LEDGE +2.5 m', 5.4], [55, 209, '08B C2 · THE PIT<i>82 × 44 m · floor 82 × 37 · waves 3–4</i>', 7.2, DK, '#ffffffe0'],
  [20, 209, 'D3<i>spawn</i>', 5.4, '#8a1020'], [101, 235, 'D4<i>spawn</i>', 5.4, '#8a1020'],
  [55, 223.5, 'ELITE REVEAL LIFT +4 m<i>named elite, wave 3</i>', 5.4, '#5a1a8a'], [40, 219, 'pillar', 4.8, '#444'], [70, 219, 'pillar', 4.8, '#444'],
  [108, 207, 'G2<i>after wave 4</i>', 5.4, MAG],
  [146, 186, "08C C3 · FOREMAN'S FLOOR<i>⌀84 · floor ⌀56 · wave 5</i>", 7.2, DK, '#ffffffe0'],
  [146, 160, 'terrace +1.5 m', 5, '#333'], [146, 152, 'terrace +3 m', 5, '#333'], [126, 150, 'wall 6 m', 5, '#333'],
  [146, 140.5, 'D5 spawn', 5.2, '#8a1020'], [146, 231.5, 'D6 spawn', 5.2, '#8a1020'],
  [184, 143.5, "FOREMAN'S OFFICE<i>balcony +6 m: he drops in</i>", 5.4, '#5a1a8a'], [163, 191, 'TROPHY CHEST', 5, '#7a5a00'],
  [198, 178, 'G3<i>after wave 5</i>', 5.4, MAG],
  [172, 130, 'TITAN ROAD 12 m · forecourt → Titan gate', 5.4, '#eee', ''],
  [229, 160, 'LANE<br>14 m', 5.2], [211, 205.5, 'CHECKPOINT · the last camp', 5.2, TEAL], [205, 222, 'PLAQUE<i>L20</i>', 5],
  [229, 218, 'RETURN<br>PAD', 5, '#1238c8'], [216, 225, 'PORTAL ARCH 18 m<i>→ hidden arena, y −150</i>', 5.6, '#1238c8'],
  [215, 186.5, 'TG TITAN GATE<i>2,496 m²</i>', 6.4, DK, '#ffffffe0'],
];
const WAVE_AT = [[38, 168, 'W1'], [72, 168, 'W2'], [30, 214, 'W3'], [82, 214, 'W4'], [134, 200, 'W5']];
// the section (elevation), looking west: z runs north (left) to south (right), true scale
function sectionSvg(z0, z1, y0, y1, w, o = {}) {
  const k = w / (z1 - z0), h = Math.round((y0 - y1) * k), X = z => ((z - z0) * k).toFixed(1), Y = y => ((y0 - y) * k).toFixed(1);
  const el = [`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;font-family:Helvetica,Arial;overflow:hidden">`];
  const R = (za, zb, ya, yb, fill, stroke = 'none', extra = '') => el.push(`<rect x="${X(Math.min(za, zb))}" y="${Y(Math.max(ya, yb))}" width="${(Math.abs(zb - za) * k).toFixed(1)}" height="${(Math.abs(yb - ya) * k).toFixed(1)}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
  const T = (z, y, t, fs = 8, fill = '#fff', anchor = 'middle', extra = '') => el.push(`<text x="${X(z)}" y="${Y(y)}" font-size="${fs}" fill="${fill}" text-anchor="${anchor}" font-weight="700" ${extra}>${t}</text>`);
  const Ln = (za, ya, zb, yb, stroke, dash = '', sw = 1) => el.push(`<line x1="${X(za)}" y1="${Y(ya)}" x2="${X(zb)}" y2="${Y(yb)}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
  const Pg = (pts, fill, stroke = 'none') => el.push(`<polygon points="${pts.map(([z, y]) => X(z) + ',' + Y(y)).join(' ')}" fill="${fill}" stroke="${stroke}"/>`);
  R(z0, z1, y0, 0, '#c6d9e8'); R(z0, z1, 0, -250, '#8b806d'); R(z0, z1, -250, y1, '#4e473f');
  for (let y = -20; y > -250; y -= 20) Ln(z0, y, z1, y, '#9a8f7b', '', .5);
  Ln(z0, -250, z1, -250, '#ff4a4a', '5 3', 1.4);
  // surface (projected: the east half, x 80-235)
  R(-250, -249, 5, 0, '#e2782c'); R(249, 250, 5, 0, '#e2782c');
  R(-237, -8, .9, 0, '#d8956f'); R(-72, -50, 9, 0, '#8f9499', '#333'); R(-8.5, 8.5, .6, 0, '#4d5257');
  for (const z of [14, 118]) { R(z - .5, z + .5, 2.6, 0, '#e2782c'); R(z - 2, z + 2, 20, 0, '#8f9499', '#333'); }
  R(121.5, 122.5, 3, 0, '#e2782c'); R(124, 136, .5, 0, '#4d5257');
  R(136, 197, 4, 0, '#b85d1e88'); R(196, 235, 5, 0, '#e2782c66');
  R(144, 146, 6, 0, '#e2782c', '#333'); R(146, 152, 3, 0, '#dcdedf', '#333'); R(152, 158, 1.5, 0, '#dcdedf', '#333');
  R(214, 220, 1.5, 0, '#dcdedf', '#333'); R(220, 226, 3, 0, '#dcdedf', '#333'); R(226, 228, 6, 0, '#e2782c', '#333');
  R(227.5, 230.5, 18, 0, '#b85d1e', '#333'); R(228, 229, 13.2, 1.2, '#3a7dff');
  // hidden: the Training Vault (y -40) and the Crate Titan arena (y -150)
  R(-99, -29, -30, -40, '#3a7dff66', '#1238c8'); Ln(-61, 3, -61, -30, '#1238c8', '3 2', 1.2);
  const A = TITAN_ARENA, cz = A.cz, Ya = A.y;
  R(cz - A.standsR, cz + A.standsR, A.ceiling, Ya - A.slab, '#2fbfd322', '#1fa7b8', 'stroke-dasharray="4 3"');
  R(cz - A.standsR, cz + A.standsR, Ya, Ya - A.slab, '#5a5f65');
  Pg([[cz - A.standsR, Ya], [cz - A.standsR, Ya + A.standsH], [cz - A.wallR, Ya + A.wallH], [cz - A.wallR, Ya]], '#8f9499', '#333');
  R(cz - A.wallR, cz - A.floorR, Ya + A.wallH, Ya, '#e2782c', '#333');
  Pg([[cz + A.wallR, Ya + 9], [cz + A.wallR, Ya + A.wallH], [cz + A.standsR, Ya + A.standsH], [cz + A.standsR, Ya + 9]], '#8f9499', '#333');
  R(cz + A.floorR, cz + A.wallR, Ya + A.wallH, Ya + 9, '#e2782c');
  R(cz + A.floorR, cz + A.standsR, Ya + 9, Ya + 8.4, '#5a5f65'); R(cz + A.floorR + .5, cz + A.floorR + 1.5, Ya + 8, Ya, '#f2f6ff99');
  R(cz - A.floorR, cz + A.floorR, Ya + .4, Ya, '#bfc2c5');
  for (const z of [cz - A.standsR + 4, cz + A.standsR - 4]) { R(z - 1, z + 1, Ya + 60, Ya + 14, '#5a5f65'); R(z - 3, z + 3, Ya + 63, Ya + 60, '#ffc35a'); }
  // the Titans: 15 m solid, 9 m and 20 m dashed; a 1.8 m player
  for (const H of TITAN.scales) {
    const B = TITAN.body, legH = B.leg * H, top = legH + B.torso * H, chosen = H === TITAN.chosen;
    const fill = chosen ? '#e2782c' : 'none', st = chosen ? '#333' : (H < TITAN.chosen ? '#2f6fd0' : '#c3249b'), ex = chosen ? '' : 'stroke-dasharray="2 2" stroke-width="1.2"';
    R(cz - .1 * H, cz + .1 * H, Ya + H, Ya + top, fill, st, ex); R(cz - .14 * H, cz + .14 * H, Ya + top, Ya + legH, fill, st, ex); R(cz - .075 * H, cz + .075 * H, Ya + legH, Ya, fill, st, ex);
  }
  R(cz + 15.6, cz + 16.4, Ya + 1.8, Ya, '#ffffff', '#111');
  Ln(229, 1.2, cz + A.standsR - 1.5, Ya + 4, '#3a7dff', '4 2', 1.6);
  if (o.labels) o.labels(T, Ln, R);
  el.push('</svg>');
  return el.join('');
}
function titanFrontSvg(H, xc, g, k, col, chosen) {   // front elevation of the blockout Titan, xc = centre px, g = ground px
  const B = TITAN.body, legH = B.leg * H, torsoH = B.torso * H, sw = B.shoulder * H, top = legH + torsoH, al = B.armLen * H, f = B.fist * H;
  const r = (x0, x1, y0, y1, fill) => `<rect x="${(xc + x0 * k).toFixed(1)}" y="${(g - y1 * k).toFixed(1)}" width="${((x1 - x0) * k).toFixed(1)}" height="${((y1 - y0) * k).toFixed(1)}" fill="${fill}" stroke="#111" stroke-width=".6"/>`;
  const o = chosen ? '#e2782c' : col, d = chosen ? '#b85d1e' : col;
  const out = [];
  for (const s of [-1, 1]) { out.push(r(s * .11 * H - .065 * H, s * .11 * H + .065 * H, 0, legH, o)); out.push(r(s * (sw / 2 + .02 * H) - .05 * H, s * (sw / 2 + .02 * H) + .05 * H, top - .1 * H - al, top - .1 * H, o)); out.push(r(s * (sw / 2 + .02 * H) - f / 2, s * (sw / 2 + .02 * H) + f / 2, top - .1 * H - al - f, top - .1 * H - al, d)); out.push(r(s * sw / 2 - .08 * H, s * sw / 2 + .08 * H, top - .14 * H, top, d)); }
  out.push(r(-.2 * H, .2 * H, legH, top, o)); out.push(r(-.1 * H, .1 * H, top + .04 * H, H, o));
  out.push(`<circle cx="${xc}" cy="${(g - (legH + torsoH * .6) * k).toFixed(1)}" r="${(.06 * H * k).toFixed(1)}" fill="#ffc35a"/>`);
  return out.join('');
}
const VIEWS = {
  plan() {
    const W = VW(); setFrame(-262, 262, -262, 262); signs.visible = false; planOnly.visible = true; budgetOnly.visible = false; placeOnly.visible = false;
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 5 · 500 m CELL · TOP-DOWN PLAN</b><span>North up. Only the SE BOTTOM (dashed orange) and the HIDDEN LAYERS changed. The Titan fight is behind a portal (⊙) in a hidden arena under the SE (dashed blue circle, floor y −150); the gauntlet takes the ground as three courts. Dashed blue squares = the Training Vault (y −40). Magenta = the gauntlet run, dashed = the Titan road.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'plan'); panelAt(top + W + 4);
    const L = $('labels'), fr = [frame.x0, frame.x1, frame.z0, frame.z1];
    mark(L, TITAN_GATE.arch.x, TITAN_GATE.arch.z - 3, W, '⊙', '#7fb0ff', 13); mark(L, 208.7, -61, W, '⊙', '#7fb0ff', 13);
    tagIn(L, fr, [W, W], 0, 92, 238, 'HIDDEN TITAN ARENA ⌀140 · y −150 (dashed circle)', 6.2, '#fff', '#1238c8d0');
    tagIn(L, fr, [W, W], 0, 186, -24, 'HIDDEN VAULT<i>y −40</i>', 6.2, '#fff', '#1238c8d0');
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>IT FITS: the gauntlet gets ${(gauntletM2 / R4_SE.gauntlet).toFixed(1)}× its round-4 ground; the Titan fights in a hidden ⌀104 m arena; ${(B_.free / 2500).toFixed(1)} % of the cell still free (was 16.3)</h3>
      <b>Titan gate</b> (surface, ${fmt(tgM2)} m²; the amphitheatre + approach were ${fmt(R4_SE.titan + R4_SE.approach)}): a 14 m walled lane off the Titan road into a 39 × 38 m plaza: the last checkpoint, the L20 plaque, the 18 m portal arch, the return pad. The 12 s intro plays inside, on arrival.<br>
      <b>Gauntlet</b> (${fmt(gauntletM2)} m², was ${fmt(R4_SE.gauntlet)}): a forecourt and three sealed courts through three gates. <b>C1</b> loading yard (waves 1–2), <b>G1</b> up to <b>C2</b> the pit (waves 3–4, the elite reveal lift), <b>G2</b> into <b>C3</b> the Foreman's floor (⌀84, wave 5), <b>G3</b> out to the Titan gate. Peak ${Math.max(...GF.map(g => g.live))} robots live (cap 12 awake, 16 on screen).<br>
      <b>Hidden layers</b>: the Crate Titan arena under the SE (x 80–220, z 95–235, y −156 to −80) and the Training Vault under band 4 (y −40 to −30). Footprints apart, ≥ ${Math.min(...LC.pairs.map(q => q.verticalGapM))} m of rock between any two layers, all inside ±250 and above −250.<br>
      <b>Unchanged</b>: the west (round 4), bands 1–6, their 60 packs, cover, chests and the road gates, to the number.`;
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
    scene.fog = null; $('cap').innerHTML = '<b>ROUND 5 · AREA BUDGET (used vs free)</b><span>Blue = the town · orange = west toys · teal = paddock · yellow→red = level bands · maroon = combat set pieces (now the gauntlet courts, its forecourt and the Titan gate) · slate = roads · bare grid = free. Round 4 in brackets. Hidden layers cost 0 m² of surface.</span>';
    const top = $('cap').offsetHeight; layoutCanvas(W, W, top); planLabels(W, top, 'budget'); panelAt(top + W + 4);
    const pct = n => (n / 2500).toFixed(1) + ' %', r = SE_.r5, q = SE_.r4;
    $('panel').hidden = false; $('foot').hidden = true;
    const row = (c, name, n, b) => `<tr><td>${sw(c)}${name}</td><td class="num">${fmt(n)}</td><td class="num">${pct(n)}</td><td class="num">(${b})</td></tr>`;
    $('panel').innerHTML = `<table style="font-size:8.4px"><tr><td style="vertical-align:top;width:47%"><h3>THE CELL, m² (round 4)</h3><table>
      ${row(KIND.town, 'Town', B_.town, R4B.town)}${row(KIND.west, 'West toys', B_.west, R4B.west)}${row(KIND.cand, 'Paddock', B_.cand, R4B.cand)}
      ${row(KIND.band, 'East bands', B_.band, R4B.band)}${row(KIND.set, 'East set pieces', B_.set, R4B.set)}${row(0x3c4148, 'Roads, strip', B_.circ, R4B.circ)}
      <tr><td>${sw(0xc3c6c9)}<b>Free</b></td><td class="num"><b>${fmt(B_.free)}</b></td><td class="num"><b>${pct(B_.free)}</b></td><td class="num">(${R4B.free})</td></tr></table>
      <h3>HIDDEN (0 m² of surface)</h3><table>
      <tr><td>Titan arena floor ⌀104</td><td class="num">${fmt(TA.floor)}</td></tr><tr><td>its stands, ⌀140 footprint</td><td class="num">${fmt(TA.footprint)}</td></tr>
      <tr><td>round 4's surface Titan floor</td><td class="num">${fmt(TA.r4Floor)}</td></tr><tr><td>Training Vault, 4 rooms</td><td class="num">4,900</td></tr></table></td>
      <td style="vertical-align:top"><h3>SE BOTTOM ${fmt(SE_.total)} m²: R4 → R5</h3><table>
      <tr><td>Gauntlet courts C1–C3</td><td class="num">${fmt(q.gauntlet)}</td><td class="num">→ <b>${fmt(r.gauntlet)}</b></td></tr>
      <tr><td>Gauntlet forecourt</td><td class="num">—</td><td class="num">→ <b>${fmt(r.forecourt)}</b></td></tr>
      <tr><td>Titan amphitheatre + approach</td><td class="num">${fmt(q.titan)}</td><td class="num">→ <b>0</b></td></tr>
      <tr><td>Titan gate (lane + plaza)</td><td class="num">—</td><td class="num">→ <b>${fmt(r.titanGate)}</b></td></tr>
      <tr><td>Titan road</td><td class="num">—</td><td class="num">→ <b>${fmt(r.road)}</b></td></tr>
      <tr><td><b>Free</b></td><td class="num">${fmt(q.free)}</td><td class="num">→ <b>${fmt(r.free)}</b></td></tr></table>
      <h3>THE GAUNTLET'S FIGHT GROUND</h3><table><tr><td></td><td class="num">floor</td><td class="num">+steps</td><td class="num">live</td><td class="num">m²/live</td></tr>
      ${GF.map(g => `<tr><td>${g.court} W${g.waves}</td><td class="num">${fmt(g.floor)}</td><td class="num">${fmt(g.stepped)}</td><td class="num">${g.live}</td><td class="num">${g.perLive}–${g.perLiveAll}</td></tr>`).join('')}
      <tr><td><b>all</b></td><td class="num"><b>${fmt(GF.reduce((a, g) => a + g.floor, 0))}</b></td><td class="num"><b>${fmt(GF.reduce((a, g) => a + g.stepped, 0))}</b></td><td></td><td class="num">R4: ${fmt(Math.PI * 28 ** 2)}</td></tr></table>
      <span style="color:#aaa">R4's fight floor was the r 28 disc (seating to r 42 not fought on).</span></td></tr></table>`;
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
    const W = VW(); signs.visible = false; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 4 → ROUND 5 · the SE bottom, same scale, north up</b><span>Top: round 4 (Titan amphitheatre r 38 + 39 m approach, gauntlet ⌀84 disc). Bottom: round 5 (three gauntlet courts, the forecourt, the Titan road and the small Titan gate; the Titan fights below, through the portal).</span>';
    const top = $('cap').offsetHeight, fr = [0, 250, 112, 250], h = Math.round(W * (fr[3] - fr[2]) / (fr[1] - fr[0]));
    const r1 = $('r1'); r1.hidden = false;
    Object.assign(r1.style, { top: top + 'px', left: '0px', width: W + 'px', height: h + 'px', backgroundImage: 'url(/tmp/ks-blockout-r5/raw/r4-se.png)', backgroundSize: `${W}px ${h}px`, backgroundPosition: '0 0' });
    setFrame(...fr); layoutCanvas(W, h, top + h + 6); render(ortho); panelAt(top + 2 * h + 12);
    const L = $('labels'); L.innerHTML = ''; L.style.top = '0px';
    const t = (row, x, z, html, fs = 7) => tagIn(L, fr, [W, h], top + row * (h + 6), x, z, html, fs, '#111', '#ffffffd8');
    t(0, 62, 182, `08 GAUNTLET<i>⌀84 · ${fmt(R4_SE.gauntlet)} m² · floor ⌀56</i>`); t(0, 134, 206, `BOSS APPROACH<i>39 × 16 · 624 m²</i>`, 6);
    t(0, 190, 176, `09 CRATE TITAN L20<i>⌀76 · ${fmt(R4_SE.titan)} m² · floor r 28</i>`);
    t(1, 55, 163, `C1<i>3,444 m²</i>`); t(1, 55, 212, `C2<i>3,608 m²</i>`); t(1, 146, 186, `C3 FOREMAN'S FLOOR<i>⌀84 · 5,542 m²</i>`);
    t(1, 80, 132, `FORECOURT<i>1,520 m²</i>`, 6); t(1, 215, 214, `TITAN<br>GATE<i>${fmt(tgM2)} m²</i>`, 6); t(1, 168, 130, 'TITAN ROAD', 5.6);
    for (const [id, x, row] of [['t1', 4, 0], ['t2', 4, 1]]) { const d = $(id); d.hidden = false; d.textContent = row ? 'ROUND 5' : 'ROUND 4'; d.style.top = top + row * (h + 6) + 4 + 'px'; d.style.left = x + 'px'; }
    $('panel').hidden = false; $('foot').hidden = true;
    $('panel').innerHTML = `<h3>WHAT MOVED IN THE SE BOTTOM (m², round 4 → round 5)</h3><table>
      <tr><td>Gauntlet (courts + forecourt)</td><td class="num">${fmt(R4_SE.gauntlet)}</td><td class="num">→ <b>${fmt(gauntletM2)}</b> (${(gauntletM2 / R4_SE.gauntlet).toFixed(1)}×)</td></tr>
      <tr><td>Fight ground (floors + steps)</td><td class="num">${fmt(Math.PI * 28 ** 2)}</td><td class="num">→ <b>${fmt(GF.reduce((a, g) => a + g.floor + g.stepped, 0))}</b></td></tr>
      <tr><td>Titan on the surface</td><td class="num">${fmt(R4_SE.titan + R4_SE.approach)}</td><td class="num">→ <b>${fmt(tgM2)}</b> (gate) + ${fmt(SE_.r5.road)} road</td></tr>
      <tr><td>Titan fight floor</td><td class="num">${fmt(TA.r4Floor)}</td><td class="num">→ <b>${fmt(TA.floor)}</b>, hidden at y −150</td></tr>
      <tr><td>SE bottom free</td><td class="num">${fmt(SE_.r4.free)}</td><td class="num">→ <b>${fmt(SE_.r5.free)}</b></td></tr></table>
      The round-4 gauntlet was one ⌀56 floor ringed by seats; round 5 is a run of three walled courts, each a sealed wave room, with stepped ground, spawn doors and cover. The SE-wall gates and the band-6 road gate are where they were.`;
    render(ortho);
  },
  seplan() {
    const W = VW(), H = VH(); full(); signs.visible = false; planOnly.visible = true; scene.fog = null; $('foot').hidden = true;
    $('cap').innerHTML = '<b>ROUND 5 · THE SE BOTTOM, CLOSE UP · every item labelled</b><span>One strip in two halves (west, east), north up, same scale. Magenta = the gauntlet run (dashed = the Titan road). W1–W5 = waves. Spawn doors D1–D6 have a closet behind.</span>';
    const top = $('cap').offsetHeight, rh = Math.floor((H - top - 4) / 2), zs = 122 * rh / W, rows = [[4, 126, 117, 117 + zs], [118, 240, 117, 117 + zs]];
    setFrame(...rows[0]); layoutCanvas(W, rh, top); render(ortho);
    const r1 = $('r1'); r1.hidden = false;
    Object.assign(r1.style, { top: top + 'px', left: '0px', width: W + 'px', height: rh + 'px', backgroundImage: `url(${renderer.domElement.toDataURL('image/png')})`, backgroundSize: `${W}px ${rh}px`, backgroundPosition: '0 0' });
    setFrame(...rows[1]); layoutCanvas(W, rh, top + rh + 4); render(ortho);
    const L = $('labels'); L.innerHTML = ''; L.style.top = '0px';
    for (const [x, z, html, fs, color, bg] of SE_TAGS) { const i = x < 122 ? 0 : 1; tagIn(L, rows[i], [W, rh], top + i * (rh + 4), x, z, html, fs, color ?? '#111', bg ?? '#ffffffc8'); }
    for (const [x, z, w] of WAVE_AT) { const i = x < 122 ? 0 : 1; stepIn(L, rows[i], [W, rh], top + i * (rh + 4), x, z, w); }
    for (const q of [...SECRETS, ...GOLD.map(g => ({ ...g, k: 'g' }))].filter(q => q.x > 100 && q.z > 120)) { const i = q.x < 122 ? 0 : 1; tagIn(L, rows[i], [W, rh], top + i * (rh + 4), q.x + 4, q.z - 4, q.k === 'b' ? '★' : '●', 9, q.k === 'b' ? '#fff' : '#ffd000', ''); }
    for (const [id, i] of [['t1', 0], ['t2', 1]]) { const d = $(id); d.hidden = false; d.textContent = i ? 'EAST HALF · x 118–240' : 'WEST HALF · x 4–126'; d.style.fontSize = '10px'; d.style.top = top + i * (rh + 4) + (i ? 14 : rh - 18) + 'px'; d.style.left = '4px'; }
  },
  section() {
    const W = VW(); full(); renderer.domElement.style.visibility = 'hidden'; $('foot').hidden = false;
    $('cap').innerHTML = '<b>ROUND 5 · SECTION (ELEVATION), LOOKING WEST</b><span>North left, south right, true scale. The surface (east half projected), the Training Vault interior (y −40) and the hidden Crate Titan arena (floor y −150, its own sky to y −80). Dashed blue = portals (a teleport, no shaft). Red dashed = CELL_BELOW, −250.</span>';
    const top = $('cap').offsetHeight, w = W - 12;
    const a = sectionSvg(-250, 250, 50, -258, w, { labels: (T, Ln) => {
      T(-61, 14, 'vault gatehouse ⊙', 7, '#111'); T(-64, -50, 'TRAINING VAULT · y −40', 7.4, '#fff'); T(165, 26, 'Titan gate arch 18 m ⊙', 7, '#111');
      T(165, -63, 'hidden TITAN ARENA · y −150', 7.4, '#fff'); T(165, -172, 'x 80–220 · z 95–235', 6.6, '#ddd');
      T(-150, 10, 'bands 3–4 (NE)', 6.6, '#111'); T(66, 10, 'band 5 · stealth yard', 6.6, '#111'); T(-246, -256, 'CELL_BELOW −250: nothing deeper', 6.8, '#ff8a8a', 'start');
      for (const [y, t] of [[0, '0'], [-40, '−40'], [-80, '−80'], [-150, '−150'], [-250, '−250']]) T(-249, y + 2, t, 6.4, '#fff', 'start');
    } });
    const b = sectionSvg(84, 246, 24, -160, w, { labels: (T, Ln) => {
      T(122, 21, 'beacon 20 m', 6.2, '#111'); T(126, 4.5, 'SE wall', 6.2, '#111'); T(130, 1.6, 'Titan road', 5.6, '#fff'); T(186, 9, "C3 · Foreman's floor (x 146)", 6.6, '#111');
      T(222, 21.5, 'portal arch 18 m', 6.6, '#111'); T(170, -3.5, 'TG lane walls 4 m, projected (x 208–222)', 5.8, '#fff');
      T(124, -38, '74 m of rock: surface (−6) → arena sky (−80)', 7, '#fff', 'start'); Ln(120, -6, 120, -80, '#fff', '', 1.2);
      T(165, -84, 'arena volume top · its own sky · y −80', 6.6, '#bff4ff'); T(102, -112, 'floodlight', 5.6, '#fff');
      T(165, -133, 'Titan 15 m (dashed: 9 m blue, 20 m magenta)', 6.4, '#fff'); T(181, -146.5, 'you 1.8 m', 5.6, '#fff', 'start');
      T(100, -122, 'stands +24 m', 6, '#111'); T(228, -146, 'alcove', 5.8, '#111'); T(213, -154.6, 'fog gate · floor ⌀104', 5.6, '#fff', 'end');
      T(165, -158.6, 'slab −156', 5.6, '#ddd'); T(240, -60, 'portal', 6.2, '#9fc0ff', 'end');
      for (const [y, t] of [[18, '+18'], [6, '+6'], [0, '0'], [-80, '−80'], [-126, '−126'], [-150, '−150']]) T(85, y + 1.5, t, 6, '#fff', 'start');
    } });
    let d = $('sec'); if (!d) { d = document.createElement('div'); d.id = 'sec'; document.body.appendChild(d); }
    Object.assign(d.style, { position: 'absolute', left: '6px', top: top + 4 + 'px', zIndex: 3, color: '#ff9a4a', fontSize: '10px', fontWeight: '700' });
    d.innerHTML = `A · THE WHOLE CELL (z −250 → 250, y +50 → −258)${a}<div style="height:6px"></div>B · THE SE, ZOOMED 3× (z 84 → 246)${b}`;
    $('foot').innerHTML = `Surface −6…+45 · vault −40…−30 (x 151–221, z −99…−29) · Titan arena −156…−80 (x 80–220, z 95–235): no overlaps, all inside ±250, above −250.`;
  },
  arenaplan() {
    const W = VW(), H = VH(); full(); world.visible = false; hiddenG.visible = true; arenaOv.visible = true; signs.visible = false; scene.fog = null;
    $('cap').innerHTML = '<b>ROUND 5 · THE HIDDEN TITAN ARENA (y −150), PLAN · three Titan heights</b><span>North up, the 15 m Titan in the middle. Rings per height: solid = its arm sweep, dashed = the nearest spot that still shows both fists, dotted = a ~7 H arena. Blue 9 m · orange 15 m (chosen) · magenta 20 m.</span>';
    const top = $('cap').offsetHeight, A = TITAN_ARENA, half = 76, fr = [A.cx - half, A.cx + half, A.cz - half, A.cz + half];
    setFrame(...fr); layoutCanvas(W, W, top); render(ortho);
    const L = $('labels'); L.innerHTML = ''; L.style.top = '0px'; const t = (x, z, html, fs = 6.2, c = '#111', bg = '#ffffffd0') => tagIn(L, fr, [W, W], top, x, z, html, fs, c, bg);
    t(A.cx, A.cz - 62, `FLOOR ⌀${2 * A.floorR} · WALL 8 m · STANDS TO ⌀${2 * A.standsR} (+24 m)`, 6.6);
    t(A.cx, A.cz + 63, 'ALCOVE: inner checkpoint · exit portal → Titan gate · fog gate', 6);
    t(A.cx - 36, A.cz - 36, 'ROLLING LANE', 5.6); t(A.cx + 36, A.cz + 36, 'ROLLING LANE<i>4 × 8 block, 1.0 s</i>', 5.6);
    t(A.cx - 45, A.cz + 2, 'EDGE-LEAP<br>BAND r 40–50', 5.4); t(A.cx, A.cz + 30, 'cover', 5.4, '#444'); t(A.cx + 30, A.cz, 'cover', 5.4, '#444');
    t(A.cx + 19, A.cz - 9, 'crate rain rings', 5.2, '#8a1020'); t(A.cx - 66, A.cz - 52, 'floodlight', 5.2, '#444');
    TS.forEach((q, i) => { const c = ['#1a4fb0', '#b85d1e', '#a0187e'][i]; t(A.cx + q.sweepM * .71 + 2, A.cz - q.sweepM * .71 - 2, `${q.H} m`, 6.4, c, '#ffffffe0'); t(A.cx - q.readM * .2, A.cz + q.readM * .98, `${q.H} m: both fists ≥ ${q.readM} m`, 5.4, c, '#ffffffd0'); t(A.cx + q.arenaD / 2 * .98, A.cz + q.arenaD / 2 * .2, `${q.arenaD} m`, 5.6, c, '#ffffffd0'); });
    const pk = 4.4, g = 152, sv = [`<svg width="${W - 16}" height="166" viewBox="0 0 ${W - 16} 166" style="display:block;font-family:Helvetica,Arial">`];
    sv.push(`<rect width="${W - 16}" height="166" fill="#c6d9e8"/><rect y="${g}" width="${W - 16}" height="14" fill="#8b806d"/>`);
    sv.push(`<line x1="0" y1="${g - 8 * pk}" x2="${W - 16}" y2="${g - 8 * pk}" stroke="#e2782c" stroke-dasharray="4 3"/><text x="${W - 18}" y="${g - 8 * pk - 2}" font-size="7" text-anchor="end" fill="#b85d1e" font-weight="700">arena wall 8 m</text>`);
    sv.push(`<line x1="0" y1="${g - 24 * pk}" x2="${W - 16}" y2="${g - 24 * pk}" stroke="#5a5f65" stroke-dasharray="4 3"/><text x="${W - 18}" y="${g - 24 * pk - 2}" font-size="7" text-anchor="end" fill="#333" font-weight="700">stands top 24 m</text>`);
    [[9, 60], [15, 170], [20, 300]].forEach(([Hh, xc], i) => { sv.push(titanFrontSvg(Hh, xc, g, pk, ['#7aa6f0', '#e2782c', '#e07acb'][i], Hh === TITAN.chosen)); sv.push(`<text x="${xc}" y="${g + 11}" font-size="8.5" text-anchor="middle" font-weight="700" fill="#fff">${Hh} m · ${(Hh / 1.8).toFixed(1)}× you${Hh === TITAN.chosen ? ' · CHOSEN' : ''}</text>`); });
    sv.push(`<rect x="${110}" y="${g - 1.8 * pk}" width="${.5 * pk}" height="${1.8 * pk}" fill="#fff" stroke="#111" stroke-width=".6"/><text x="114" y="${g - 9}" font-size="7" fill="#111" font-weight="700">you 1.8 m</text></svg>`);
    $('panel').hidden = false; $('foot').hidden = true; panelAt(top + W + 4);
    $('panel').innerHTML = sv.join('') + `<table style="font-size:8.2px;margin-top:3px"><tr><td><b>Titan</b></td><td class="num"><b>sweep r</b></td><td class="num"><b>escape</b></td><td class="num"><b>tell 0.9 / ×√(H/9)</b></td><td class="num"><b>both fists</b></td><td class="num"><b>arena 7H</b></td><td class="num"><b>sprint across</b></td><td class="num"><b>4×8 block</b></td></tr>
      ${TS.map(q => `<tr><td>${q.H} m${q.H === TITAN.chosen ? ' ✔' : ''}</td><td class="num">${q.sweepM} m</td><td class="num">${q.escapeM} m · ${q.escapeS} s</td><td class="num">${q.fairAt09 ? 'fair' : '<b style="color:#ff6a6a">unfair</b>'} / ${q.tellScaledS} s fair</td><td class="num">≥ ${q.readM} m</td><td class="num">⌀${q.arenaD}</td><td class="num">${q.crossS} s</td><td class="num">${Math.round(q.blockVsH * 100)} % of H</td></tr>`).join('')}</table>
      <b>Chosen: 15 m, arena floor ⌀104</b> (7 H). From fighting range (13–16 m) it overfills a portrait frame and you lose its head when you close in: massive. It stays fair at the written tells (0.76 s to clear the sweep against 0.9 s) and the 4 × 8 block still reads as a thrown crate. 9 m reads as a big elite; at 20 m the sweep needs a 1.34 s tell, the fists leave the frame inside 18 m and the arena grows to ⌀140 (19 s to cross).`;
    render(ortho);
  },
  tgate() { full(); persp.fov = 72; persp.fov = 80; persp.position.set(216, EYE, 194); persp.lookAt(216, 6, 229); signsWithin(60); caption('GROUND VIEW · THE TITAN GATE · eye 1.7 m, from the lane', 'Stepping out of the 14 m lane (from the Titan road or G3) into the 39 × 38 m plaza, facing south: the last checkpoint and the L20 plaque on the right, the return pad (where you come back out) on the left, the 18 m portal arch ahead: the boss fog. Walk in and you are in the hidden arena; the intro plays there.'); render(persp); },
  gentry() { full(); persp.fov = 76; persp.fov = 84; persp.position.set(63, 3 + EYE, 148.6); persp.lookAt(57, -2, 180); signsWithin(75); caption('GROUND VIEW · ENTERING THE GAUNTLET · C1 entry terrace, +3 m', 'Through the entry onto C1\'s terrace, facing south over the 82 × 34 m floor: wave 2 Riveters among the crate stacks and half walls (D1 is out of frame right, D2 left), the 5 m south wall, and beyond it C2\'s elite-reveal banner. G1, out of frame right, opens after wave 2 and climbs to C2.'); render(persp); },
  arena() {
    full(); world.visible = false; hiddenG.visible = true; const A = TITAN_ARENA;
    persp.fov = 70; persp.position.set(A.cx + 15.2, A.y + 2.6, A.cz + 15.2); persp.lookAt(A.cx, A.y + 6, A.cz); signsWithin(60);
    caption('GROUND VIEW · THE HIDDEN ARENA (y −150) · the 15 m Crate Titan', 'Third-person camera 5 m behind you (white), you 16 m from its axis, the nearest spot that keeps both fists in frame, standing in the SE rolling lane: four P2 Mites at its feet, crate-rain rings, the 24 m stands and a floodlight behind. Its own sky: the arena is a hidden region, 74 m under the SE.'); render(persp);
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
  world.visible = true; hiddenG.visible = false; arenaOv.visible = false; renderer.domElement.style.visibility = 'visible'; $('sec')?.remove(); $('labels').style.top = '0px';
  signs.visible = true; signScale(.8); persp.near = .3; planOnly.visible = false; budgetOnly.visible = false; placeOnly.visible = false;
  scene.fog = new THREE.Fog(0xa9c4dc, 350, 1400); $('labels').innerHTML = ''; $('panel').hidden = true;
  persp.aspect = VW() / VH(); persp.updateProjectionMatrix();
}
function signsWithin(d) { for (const sp of signList) { const p = new THREE.Vector3(); sp.getWorldPosition(p); sp.visible = p.distanceTo(persp.position) <= (packSigns.includes(sp) ? 32 : d); } }
function signScale(f) { for (const sp of signList) sp.scale.set(sp.userData.k[0] * f, sp.userData.k[1] * f, 1); }
function caption(title, text) {
  $('cap').innerHTML = `<b>${title}</b><span>${text}</span>`;
  $('foot').hidden = false; $('foot').textContent = 'Showcase Template · round 5 grey blockout · art/showcase-template/round-5-blockout · labels are burned in';
}
const ui = $('ui'); for (const k of [...Object.keys(VIEWS), 'orbit']) { const o = document.createElement('option'); o.textContent = k; ui.appendChild(o); }
ui.onchange = () => show(ui.value);
function show(name) {
  current = name; controls.enabled = name === 'orbit'; $('panel').style.top = ''; $('panel').style.bottom = '';
  world.visible = true; hiddenG.visible = false; arenaOv.visible = false; renderer.domElement.style.visibility = 'visible'; $('sec')?.remove(); $('t1').style.fontSize = '';
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
    night: P.packs.filter(p => p.night).length, walks: W_, gauntlet: GF, gauntletView: GV, titan: TS, layers: LC, se: SE_, titanArena: TA }) };
window.labReady = true;
