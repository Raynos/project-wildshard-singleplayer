// crossroads rig: SF22a's synthetic 2 × 2 crossroads (docs/plans/SHARD-PLATFORM.md §3.2, §4 F0 SF22a).
//
// A MEASUREMENT TOOL, NOT GAME CODE. Plain three.js, nothing from src/. It stands the camera where four shards meet and
// makes everything the streaming design says is resident there, each unit sized EXACTLY at §3.2's caps:
//   · n0 L0 tiles (62.5 m; default 40 = 32 in the 150 m ring + 8 heading lookahead), n0 / 4 from each of four shards:
//     5 MB resident, ~40k tris, 8 draws (terrain, one unique mesh, six instanced draws of the shard library's props)
//   · libs shard libraries (default 4): 25 MB each (17 × 1024² material textures + six prop meshes)
//   · n1 L1 tiles (125 m; default 32): 2.5 MB, 10k tris, 2 draws, a self-contained baked atlas (no library)
//   · nf far proxies (default 9, the 3 × 3 grid): 1.6 MB, 8k tris, 1 draw, one 1024² atlas
//   · sims whole-shard sim residencies (default 4): 40 MB of written CPU arrays each (colliders, entities, scripts)
//   · decode / refinement overlap: during the measure, every `churn` s (default 2) one more L0 tile is decoded and
//     uploaded at a lookahead slot while the oldest of two streamed tiles is disposed (REPLACE), so the measure carries
//     the in-flight decode buffers, the double residency and the build hitches
// in four material styles (toon · painterly · PBR · stylized Phong), one per shard. The engine base is not in the rig:
// it is the empty template shard's reading (sf22a-memory.md adds the two).
// Colour maps use the best block format the platform has (ASTC 4×4, else BC3, both 1 byte a texel; else RGBA8 and the
// units go over cap, which the stats say). Data maps (the per-tile splat) stay RGBA8. What a unit's GPU parts don't use
// of its cap is a CPU-side array (colliders, entities), written so its pages are really resident.
//
// Phases (window.__rig.phase), for an outside sampler: empty (renderer + sky only, `empty` s) → loading → warm (one
// unculled frame uploads everything) → settle (6 s, static, frame times) → measure (`secs` s of frame times while tiles
// stream, the camera turning a full circle) → done (keeps rendering). window.__rig carries the config, the accounted bytes, the frame stats.
// Query (a tool page, so query parameters are fine here; nothing in src/ reads them):
//   n0 n1 nf libs sims  counts · churn  seconds between streamed tiles (0 = none) · cpu=drop|keep  drop the JS copies of uploaded geometry / textures (default drop) ·
//   empty secs  phase lengths · shadow=0|1 (default 1, a 2048² sun shadow over the L0 ring) · dpr (cap, default 2)
// Staged and served by scripts/crossroads-rig/stage.sh; measured by desktop-probe.mjs and sim-probe.mjs.
import * as THREE from 'three';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const CFG = {
  n0: num('n0', 40), n1: num('n1', 32), nf: num('nf', 9), libs: num('libs', 4),
  sims: num('sims', 4), churn: num('churn', 2), cpu: q.get('cpu') ?? 'drop', empty: num('empty', 8), secs: num('secs', 20), shadow: num('shadow', 1), dpr: num('dpr', 2),
  capsMB: { l0: 5, l1: 2.5, far: 1.6, lib: 25, sim: 40 }, trisCap: { l0: 40000, l1: 10000, far: 8000 },
};
const MB = 1e6;
const STYLES = ['toon', 'painterly', 'pbr', 'stylized'];
const PALETTES = [ // per style: ground, accent (0..1 RGB)
  [[0.45, 0.62, 0.38], [0.93, 0.78, 0.45]], [[0.62, 0.7, 0.36], [0.85, 0.55, 0.3]],
  [[0.3, 0.33, 0.24], [0.42, 0.36, 0.3]], [[0.86, 0.7, 0.48], [0.7, 0.42, 0.3]],
];
const R = { phase: 'boot', cfg: CFG, format: '', accounted: {}, frames: {}, info: null, error: null, t: {} };
window.__rig = R;
const hud = document.getElementById('hud');
const say = (s) => { if (hud) hud.textContent = s; };
const setPhase = (p) => { R.phase = p; R.t[p] = performance.now(); say(`crossroads rig: ${p}`); };
const yieldNow = () => new Promise((resolve) => { setTimeout(resolve, 0); });

// ── renderer, scene ──
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.dpr));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = CFG.shadow === 1;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa3b8);
scene.fog = new THREE.Fog(0x8fa3b8, 350, 1700);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 2200);
camera.position.set(0, 1.7, 0);
scene.add(new THREE.HemisphereLight(0xbfd2e6, 0x5a5040, 0.8));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(80, 140, 60);
sun.castShadow = CFG.shadow === 1;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 400 });
scene.add(sun, sun.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ── texture formats ──
const ext = renderer.extensions;
const FMT = ext.has('WEBGL_compressed_texture_astc') ? { name: 'astc4x4', three: THREE.RGBA_ASTC_4x4_Format }
  : ext.has('WEBGL_compressed_texture_s3tc') ? { name: 'bc3', three: THREE.RGBA_S3TC_DXT5_Format }
    : { name: 'rgba8', three: THREE.RGBAFormat };
R.format = FMT.name;
const u16 = (v) => Math.max(0, Math.min(65535, Math.round(v * 65535)));
const c565 = (r, g, b) => (Math.round(r * 31) << 11) | (Math.round(g * 63) << 5) | Math.round(b * 31);
/** one 16-byte block of a solid colour, in the platform's block format */
function writeBlock(d, o, r, g, b) {
  if (FMT.name === 'astc4x4') { // a void-extent (constant colour) block: 0x1FC, LDR, reserved 11, no extent, RGBA16
    d[o] = 0xfc; d[o + 1] = 0xfd; d[o + 2] = 0xff; d[o + 3] = 0xff; d[o + 4] = 0xff; d[o + 5] = 0xff; d[o + 6] = 0xff; d[o + 7] = 0xff;
    const R16 = u16(r), G16 = u16(g), B16 = u16(b);
    d[o + 8] = R16 & 255; d[o + 9] = R16 >> 8; d[o + 10] = G16 & 255; d[o + 11] = G16 >> 8;
    d[o + 12] = B16 & 255; d[o + 13] = B16 >> 8; d[o + 14] = 255; d[o + 15] = 255;
  } else { // BC3: alpha 255 everywhere, then a BC1 block whose two endpoints are the colour
    d[o] = 255; d[o + 1] = 255; for (let i = 2; i < 8; i++) d[o + i] = 0;
    const c = c565(r, g, b);
    d[o + 8] = c & 255; d[o + 9] = c >> 8; d[o + 10] = c & 255; d[o + 11] = c >> 8; d[o + 12] = 0; d[o + 13] = 0; d[o + 14] = 0; d[o + 15] = 0;
  }
}
const hash = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
/** a colour map at `size`², full mip chain, in the block format (or RGBA8): returns { t: the texture, gpu: its GPU bytes, js: its JS copy's bytes } */
function colourMap(size, base, accent, seed) {
  const pat = (u, v) => {
    const n = 0.5 + 0.25 * Math.sin(u * 23 + seed) * Math.sin(v * 19 - seed) + 0.25 * hash(Math.floor(u * 48), Math.floor(v * 48), seed);
    const t = n > 0.62 ? 1 : 0;
    const k = 0.82 + 0.3 * n;
    return [(t ? accent[0] : base[0]) * k, (t ? accent[1] : base[1]) * k, (t ? accent[2] : base[2]) * k];
  };
  if (FMT.name === 'rgba8') {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const [r, g, b] = pat(x / size, y / size), o = (y * size + x) * 4;
      data[o] = r * 255; data[o + 1] = g * 255; data[o + 2] = b * 255; data[o + 3] = 255;
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
    return { t, gpu: Math.round((size * size * 4 * 4) / 3), js: data.byteLength };
  }
  const mips = [];
  let bytes = 0;
  for (let w = size; ; w = Math.max(1, w >> 1)) {
    const bw = Math.max(1, Math.ceil(w / 4)), d = new Uint8Array(bw * bw * 16);
    for (let by = 0; by < bw; by++) for (let bx = 0; bx < bw; bx++) {
      const [r, g, b] = pat(bx / bw, by / bw);
      writeBlock(d, (by * bw + bx) * 16, r, g, b);
    }
    mips.push({ data: d, width: w, height: w });
    bytes += d.byteLength;
    if (w === 1) break;
  }
  const t = new THREE.CompressedTexture(mips, size, size, FMT.three);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return { t, gpu: bytes, js: bytes };
}
/** an RGBA8 data map (a splat / control map: not block-compressible without loss), mipmapped on the GPU */
function dataMap(size, seed) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = (i / size) | 0;
    data[i * 4] = 128 + 127 * Math.sin(x * 0.05 + seed); data[i * 4 + 1] = 255 * hash(x >> 3, y >> 3, seed); data[i * 4 + 2] = 200; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return { t, gpu: Math.round((size * size * 4 * 4) / 3), js: data.byteLength };
}

// ── accounting ──
const acct = (cls) => (R.accounted[cls] ??= { count: 0, gpuGeomB: 0, gpuTexB: 0, cpuB: 0, padB: 0, jsCopyB: 0, tris: 0, draws: 0, overCap: 0 });
const retained = []; // CPU-side arrays the units keep (colliders, entity pads): referenced so they stay resident
const uploadTextures = [];
const geomBytes = (g) => {
  let b = g.index ? g.index.array.byteLength : 0;
  for (const a of Object.values(g.attributes)) b += a.array.byteLength;
  return b;
};
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
/** drop a geometry's JS arrays once uploaded (cpu=drop), the way a streaming format would */
function prepGeometry(g) {
  g.computeBoundingSphere(); g.computeBoundingBox();
  if (CFG.cpu === 'drop') {
    const drop = function drop() { this.array = null; };
    for (const a of Object.values(g.attributes)) a.onUpload(drop);
    if (g.index) g.index.onUpload(drop);
  }
  return g;
}
/** fill the unit to its cap with a CPU-side array whose pages are written */
function pad(cls, usedB, keep = retained, a = acct(cls)) {
  const cap = CFG.capsMB[cls] * MB, left = cap - usedB;
  if (left < 0) { a.overCap++; return; }
  const f = new Float32Array(Math.floor(left / 4));
  for (let i = 0; i < f.length; i += 1024) f[i] = i; // touch every page
  f.fill(1.5);
  keep.push(f);
  a.padB += f.byteLength; a.cpuB += f.byteLength;
}

// ── shapes ──
function heightAt(x, z, seed) {
  return 2.5 * Math.sin(x * 0.031 + seed) * Math.cos(z * 0.027 - seed) + 1.2 * Math.sin(x * 0.11 + z * 0.07) + 0.4 * Math.sin(x * 0.37 - z * 0.41);
}
function terrain(size, segs, cx, cz, seed, y0) {
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, y0 + heightAt(p.getX(i) + cx, p.getZ(i) + cz, seed));
  g.computeVertexNormals();
  return g;
}
function blob(detail, radius, seed) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.18 * Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7) + 0.08 * Math.sin(v.z * 7.3 - seed);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function cards(n, size, seed) {
  const pos = new Float32Array(n * 4 * 3), nor = new Float32Array(n * 4 * 3), uv = new Float32Array(n * 4 * 2), idx = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 1, seed) - 0.5) * size, z = (hash(i, 2, seed) - 0.5) * size, a = hash(i, 3, seed) * Math.PI, h = 3 + 5 * hash(i, 4, seed), w = 2;
    const dx = Math.cos(a) * w, dz = Math.sin(a) * w, y = heightAt(x, z, seed) - 1;
    const quad = [[x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx, y + h, z + dz], [x - dx, y + h, z - dz]];
    quad.forEach((c, k) => { pos.set(c, (i * 4 + k) * 3); nor.set([-Math.sin(a), 0, Math.cos(a)], (i * 4 + k) * 3); uv.set([k === 0 || k === 3 ? 0 : 1, k < 2 ? 0 : 1], (i * 4 + k) * 2); });
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ── materials, one family per style ──
const gradient = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
gradient.needsUpdate = true;
function styleMaterial(style, m) {
  switch (style) {
    case 'toon': return new THREE.MeshToonMaterial({ map: m.map, gradientMap: gradient, side: m.side ?? THREE.FrontSide });
    case 'painterly': {
      const mat = new THREE.MeshLambertMaterial({ map: m.map, emissiveMap: m.second ?? null, emissive: m.second ? 0x181818 : 0x000000, side: m.side ?? THREE.FrontSide });
      mat.onBeforeCompile = (s) => { // a brush-stroke modulation, so the painterly program differs from Lambert's
        s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 0.9 + 0.2 * sin(vMapUv.x * 90.0 + sin(vMapUv.y * 40.0) * 3.0);');
      };
      mat.customProgramCacheKey = () => 'painterly';
      return mat;
    }
    case 'pbr': return new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normal ?? null, roughnessMap: m.orm ?? null, metalnessMap: m.orm ?? null, aoMap: m.second ?? m.orm ?? null, roughness: 0.9, metalness: 0.05, side: m.side ?? THREE.FrontSide });
    default: return new THREE.MeshPhongMaterial({ map: m.map, normalMap: m.normal ?? null, specularMap: m.second ?? null, shininess: 18, side: m.side ?? THREE.FrontSide });
  }
}

// ── the units ──
const PROP_DETAIL = [3, 4, 5, 6, 7, 8]; // 320 · 500 · 720 · 980 · 1280 · 1620 tris
function makeLibrary(si) {
  const style = STYLES[si % 4], [base, accent] = PALETTES[si % 4], a = acct('lib');
  const tex = [];
  for (let k = 0; k < 17; k++) {
    const { t, gpu, js } = colourMap(1024, base.map((c) => c * (0.8 + 0.03 * k)), accent, si * 31 + k);
    tex.push(t); uploadTextures.push(t); a.gpuTexB += gpu; if (CFG.cpu === 'keep') a.jsCopyB += js;
  }
  const props = PROP_DETAIL.map((d, k) => prepGeometry(blob(d, 1, si * 7 + k)));
  let geo = 0;
  for (const g of props) geo += geomBytes(g);
  a.gpuGeomB += geo; if (CFG.cpu === 'keep') a.jsCopyB += geo;
  const mats = props.map((_, k) => styleMaterial(style, { map: tex[k], normal: tex[6 + k], orm: tex[12 + (k % 4)] }));
  a.count++;
  pad('lib', a.gpuTexB / a.count + geo); // the libraries are identical in size
  return { style, base, accent, tex, props, mats, si };
}
const scratchAcct = () => ({ count: 0, gpuGeomB: 0, gpuTexB: 0, cpuB: 0, padB: 0, jsCopyB: 0, tris: 0, draws: 0, overCap: 0 });
/** one L0 tile; `churn` = a streamed-in tile during the measure (own arrays, uploaded at once, not in the totals) */
function addL0(lib, cx, cz, seed, churn = false) {
  const a = churn ? scratchAcct() : acct('l0'), own = churn ? [] : retained, ims = [];
  const g = new THREE.Group(); g.position.set(cx, 0, cz); scene.add(g);
  const { t: detail, gpu: dB, js: dJ } = colourMap(1024, lib.base, lib.accent, seed);
  const { t: splat, gpu: sB, js: sJ } = dataMap(512, seed);
  if (churn) { for (const t of [detail, splat]) { renderer.initTexture(t); dropTexture(t); } } else uploadTextures.push(detail, splat);
  const terr = prepGeometry(terrain(62.5, 64, cx, cz, lib.si, 0));
  const tMat = styleMaterial(lib.style, { map: detail, normal: lib.tex[6], second: splat, orm: lib.tex[12] });
  const tMesh = new THREE.Mesh(terr, tMat); tMesh.receiveShadow = true; g.add(tMesh);
  const uniq = blob(19, 9, seed); uniq.translate(0, heightAt(cx, cz, lib.si) + 3, 0); prepGeometry(uniq);
  const uMesh = new THREE.Mesh(uniq, lib.mats[0]); uMesh.castShadow = true; uMesh.receiveShadow = true; g.add(uMesh);
  // colliders: the heightfield and the unique mesh's trimesh, kept on the CPU
  const hf = new Float32Array(65 * 65); for (let i = 0; i < hf.length; i++) hf[i] = heightAt(i % 65, i / 65, seed);
  const tri = new Float32Array(uniq.attributes.position.array); own.push(hf, tri);
  let geo = geomBytes(terr) + geomBytes(uniq), tris = triCount(terr) + triCount(uniq), inst = 0;
  const per = (CFG.trisCap.l0 - tris) / 6, m4 = new THREE.Matrix4(), qn = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  lib.props.forEach((pg, k) => {
    const n = Math.max(1, Math.floor(per / triCount(pg)));
    const im = new THREE.InstancedMesh(pg, lib.mats[k], n);
    for (let i = 0; i < n; i++) {
      const x = (hash(i, k, seed) - 0.5) * 58, z = (hash(k, i, seed + 1) - 0.5) * 58, s = 1.5 + 2.5 * hash(i, k + 9, seed);
      m4.compose(ps.set(x, heightAt(x + cx, z + cz, lib.si) + s * 0.6, z), qn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 5, k)), sc.set(s, s * (0.8 + hash(i, 6, k)), s));
      im.setMatrixAt(i, m4);
    }
    im.computeBoundingSphere();
    if (CFG.cpu === 'drop') im.instanceMatrix.onUpload(function dropArray() { this.array = null; });
    im.castShadow = true; im.receiveShadow = true; g.add(im); ims.push(im);
    tris += n * triCount(pg); inst += n * 64;
  });
  geo += inst;
  const used = geo + dB + sB + hf.byteLength + tri.byteLength;
  a.count++; a.gpuGeomB += geo; a.gpuTexB += dB + sB; a.cpuB += hf.byteLength + tri.byteLength; a.tris += tris; a.draws += 8;
  if (CFG.cpu === 'keep') a.jsCopyB += geo + dJ + sJ;
  pad('l0', used, own, a);
  return { g, own, ims, textures: [detail, splat], geoms: [terr, uniq], mats: [tMat] };
}
/** a shard's whole sim residency (colliders, heightfield, entities, scripts; §3.2's 40 MB), as written CPU arrays */
function addSim() { acct('sim').count++; pad('sim', 0); }
function dropTexture(t) {
  if (CFG.cpu !== 'drop') return;
  if (t.isCompressedTexture) t.mipmaps = []; else if (t.image) t.image = { data: null, width: t.image.width, height: t.image.height };
}
function disposeTile(tile) {
  scene.remove(tile.g);
  for (const x of [...tile.geoms, ...tile.mats, ...tile.textures, ...tile.ims]) x.dispose();
  tile.own.length = 0;
}
function addL1(lib, cx, cz, seed) {
  const a = acct('l1');
  const g = new THREE.Group(); g.position.set(cx, -0.8, cz); scene.add(g);
  const { t: atlas, gpu: aB, js: aJ } = colourMap(1024, lib.base, lib.accent, seed);
  const { t: n2, gpu: nB, js: nJ } = colourMap(512, [0.5, 0.5, 1], [0.5, 0.5, 1], seed + 1);
  const { t: s2, gpu: sB, js: sJ } = colourMap(512, [0.7, 0.7, 0.7], [0.4, 0.4, 0.4], seed + 2);
  uploadTextures.push(atlas, n2, s2);
  const mat = styleMaterial(lib.style, { map: atlas, normal: n2, second: s2, orm: s2 });
  const cardMat = styleMaterial(lib.style, { map: atlas, side: THREE.DoubleSide });
  const terr = prepGeometry(terrain(125, 64, cx, cz, lib.si, 0)), cd = prepGeometry(cards(900, 120, seed));
  const m1 = new THREE.Mesh(terr, mat), m2 = new THREE.Mesh(cd, cardMat); m1.receiveShadow = true; g.add(m1, m2);
  const geo = geomBytes(terr) + geomBytes(cd);
  a.count++; a.gpuGeomB += geo; a.gpuTexB += aB + nB + sB; a.tris += triCount(terr) + triCount(cd); a.draws += 2;
  if (CFG.cpu === 'keep') a.jsCopyB += geo + aJ + nJ + sJ;
  pad('l1', geo + aB + nB + sB);
}
const hiddenAfterWarm = [];
function addFar(style, si, cx, cz, near) {
  const a = acct('far'), [base, accent] = PALETTES[si % 4];
  const { t: atlas, gpu: aB, js: aJ } = colourMap(1024, base, accent, 900 + si);
  uploadTextures.push(atlas);
  const terr = prepGeometry(terrain(500, 64, cx, cz, si, -3));
  const m = new THREE.Mesh(terr, styleMaterial(style, { map: atlas }));
  m.position.set(cx, 0, cz); scene.add(m);
  if (near) hiddenAfterWarm.push(m); // REPLACE refinement: a near shard's proxy is resident but its L0 / L1 draw instead
  const geo = geomBytes(terr);
  a.count++; a.gpuGeomB += geo; a.gpuTexB += aB; a.tris += triCount(terr); a.draws += 1;
  if (CFG.cpu === 'keep') a.jsCopyB += geo + aJ;
  pad('far', geo + aB);
}

// ── frame loop and stats ──
const frames = { all: [], render: [], calls: [], tris: [] };
let lastT = 0;
const t0 = performance.now();
function loop(t) {
  requestAnimationFrame(loop);
  const sec = (t - t0) / 1000;
  camera.rotation.set(0, (sec * 2 * Math.PI) / 20, 0, 'YXZ');
  sun.position.set(camera.position.x + 80, 140, camera.position.z + 60); sun.target.position.copy(camera.position);
  const a = performance.now();
  renderer.render(scene, camera);
  const b = performance.now();
  if (lastT > 0 && (R.phase === 'measure' || R.phase === 'empty' || R.phase === 'settle')) {
    const f = (frames[R.phase] ??= { dt: [], cpu: [], calls: 0, tris: 0, n: 0 });
    f.dt.push(t - lastT); f.cpu.push(b - a); f.calls += renderer.info.render.calls; f.tris += renderer.info.render.triangles; f.n++;
  }
  lastT = t;
}
const pct = (arr, p) => { if (arr.length === 0) return null; const s = [...arr].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 100) / 100; };
function summarise(f) {
  if (!f || f.dt.length === 0) return null;
  const mean = f.dt.reduce((s, x) => s + x, 0) / f.dt.length;
  return { frames: f.dt.length, fps: Math.round(10000 / mean) / 10, p50ms: pct(f.dt, 0.5), p95ms: pct(f.dt, 0.95), p99ms: pct(f.dt, 0.99),
    under33pct: Math.round((1000 * f.dt.filter((x) => x <= 33.4).length) / f.dt.length) / 10, under17pct: Math.round((1000 * f.dt.filter((x) => x <= 16.8).length) / f.dt.length) / 10,
    renderCpuP50ms: pct(f.cpu, 0.5), renderCpuP95ms: pct(f.cpu, 0.95), calls: Math.round(f.calls / f.n), triangles: Math.round(f.tris / f.n) };
}
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function main() {
  requestAnimationFrame(loop);
  setPhase('empty');
  await wait(CFG.empty * 1000);
  R.frames.empty = summarise(frames.empty);
  setPhase('loading');
  // the highway: one engine-owned strip each way
  const road = new THREE.MeshLambertMaterial({ color: 0x5b5d60 });
  for (const rot of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(20, 1700).rotateX(-Math.PI / 2), road); m.rotation.y = rot; m.position.y = 0.05; scene.add(m); }
  const libs = [];
  for (let s = 0; s < CFG.libs; s++) { libs.push(makeLibrary(s)); await yieldNow(); }
  const quads = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const order = (n) => { const c = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c.push([i, j]); return c.sort((p, r) => (p[0] ** 2 + p[1] ** 2) - (r[0] ** 2 + r[1] ** 2) || p[0] - r[0]); };
  const l0cells = order(8), l1cells = order(6).filter(([i, j]) => !(i + j <= 1));
  for (let k = 0; k < CFG.n0; k++) {
    const qi = k % 4, [sx, sz] = quads[qi], [i, j] = l0cells[Math.floor(k / 4)];
    addL0(libs[qi % libs.length], sx * (27.5 + 62.5 * (i + 0.5)), sz * (27.5 + 62.5 * (j + 0.5)), 1000 + k);
    if (k % 4 === 3) await yieldNow();
  }
  for (let k = 0; k < CFG.n1; k++) {
    const qi = k % 4, [sx, sz] = quads[qi], [i, j] = l1cells[Math.floor(k / 4)];
    addL1(libs[qi % libs.length], sx * (27.5 + 125 * (i + 0.5)), sz * (27.5 + 125 * (j + 0.5)), 2000 + k);
    if (k % 4 === 3) await yieldNow();
  }
  const centres = [-277.5, 277.5, 832.5];
  for (let k = 0; k < CFG.nf; k++) {
    const cx = centres[k % 3], cz = centres[Math.floor(k / 3) % 3], near = Math.abs(cx) < 300 && Math.abs(cz) < 300;
    addFar(STYLES[k % 4], k, cx, cz, near);
  }
  setPhase('warm');
  for (const t of uploadTextures) renderer.initTexture(t);
  for (const t of uploadTextures) dropTexture(t);
  const culled = [];
  scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  for (const o of culled) o.frustumCulled = true;
  for (const m of hiddenAfterWarm) m.visible = false;
  for (let s = 0; s < CFG.sims; s++) addSim();
  setPhase('settle'); // static: nothing streams
  await wait(6000);
  R.frames.settle = summarise(frames.settle);
  setPhase('measure'); // streaming: every `churn` s one L0 tile streams in at a lookahead slot and the oldest of two goes
  const live = [], builds = [], end = performance.now() + CFG.secs * 1000;
  let swaps = 0;
  while (performance.now() < end) {
    if (CFG.churn > 0) {
      const qi = swaps % 4, [sx, sz] = quads[qi], [i, j] = l0cells[Math.floor(CFG.n0 / 4) + (Math.floor(swaps / 4) % 3)];
      const b0 = performance.now();
      live.push(addL0(libs[qi % libs.length], sx * (27.5 + 62.5 * (i + 0.5)), sz * (27.5 + 62.5 * (j + 0.5)), 5000 + swaps, true));
      builds.push(performance.now() - b0);
      if (live.length > 2) { const old = live.shift(); if (old) disposeTile(old); }
      swaps++;
    }
    await wait(CFG.churn > 0 ? CFG.churn * 1000 : 1000);
  }
  for (const t of live) disposeTile(t);
  R.churn = { swaps, liveMax: 2, buildMsP50: pct(builds, 0.5), buildMsMax: builds.length > 0 ? Math.round(Math.max(...builds)) : null };
  R.frames.measure = summarise(frames.measure);
  const tot = { gpuGeomB: 0, gpuTexB: 0, cpuB: 0, jsCopyB: 0 };
  for (const a of Object.values(R.accounted)) for (const k of Object.keys(tot)) tot[k] += a[k];
  R.accounted.total = { ...tot, residentMB: Math.round((tot.gpuGeomB + tot.gpuTexB + tot.cpuB) / 1e4) / 100 };
  R.info = { memory: { ...renderer.info.memory }, programs: renderer.info.programs?.length ?? null, jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / MB) : null,
    drawingBuffer: [renderer.domElement.width, renderer.domElement.height] };
  const m = R.frames.measure;
  say(`crossroads rig (${R.format}, cpu ${CFG.cpu}): ${R.accounted.total.residentMB} MB accounted\n${m ? `${m.fps} fps · p95 ${m.p95ms} ms · ${m.calls} calls · ${(m.triangles / 1e6).toFixed(2)} M tris` : ''}`);
  setPhase('done');
}
main().catch((/** @type {unknown} */ e) => { R.error = e instanceof Error ? (e.stack ?? e.message) : String(e); setPhase('error'); say(`crossroads rig error: ${R.error}`); });
