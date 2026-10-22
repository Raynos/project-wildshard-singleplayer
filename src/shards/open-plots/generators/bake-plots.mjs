// The open-plots generator (SHARD-PLATFORM SF88g, G538/G539/G541/G545): one plot world GLB per idea row of
// outputs.json (SF88g: each its own product), built from data alone. A 500 m plot on a flat floor with a kerb broken by four entries, the showroom in
// the middle: a low round plinth (radius 10 m) with a glowing rim, the idea's hologram standing on it (drawn by the one
// shared `hologram` graph, which turns it), the idea's billboard behind it (north, +Z) and the 'OPEN PLOT · COMING SOON'
// sign in front, and a striped beacon in each corner with a cyan sky beam (G539: capped at 60 m, fading with height in
// the `beam` graph, at every distance). Collision is its own `collide_` nodes (floor, kerb, plinth, billboard, sign and
// beacon posts), never the hologram or a beam.
//
// The hologram's vertex colours carry its edges for the graph: each triangle's three corners are unique vertices and
// colour channel i is half the barycentric of corner i, lifted by 0.5 when the edge opposite corner i is not a feature
// edge (a crease over FEATURE_DEGREES or an open border). The graph draws a faint line where any channel's barycentric
// reaches 0 (the wireframe) and a bright one where an unlifted channel does (the feature edges).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { ACCENTS } from '@wildshard/format/accent';

const ROOT = resolve(import.meta.dirname, '..');
const REPO = resolve(ROOT, '../../..');
const FEATURE_DEGREES = 28;
const PLINTH = { radius: 10, height: 0.6, rim: 0.7, segments: 64 };
const BILLBOARD = { z: 26, width: 24, height: 13.5, bottom: 5, depth: 0.5 };
const SIGN = { x: 15, z: -10, width: 7.5, height: 2.5, bottom: 1.2, yaw: 0.4 };
const KERB = { inner: 238, outer: 240, height: 0.5, gap: 15 };
const FLOOR_STEP = 25;
/** G608: the hologram's scale, the beams' heights and the floor's accent tint (data/plot.json) */
const PLOT = JSON.parse(readFileSync(resolve(ROOT, 'data/plot.json'), 'utf8'));
/** G539 / G608: the corner beacons (inside the kerb's corners) and their beams, at full height (data/plot.json) */
const BEACON = { at: 244, half: 0.45, band: 0.9, bands: 6, beam: PLOT.beam.height, twin: PLOT.beam.twin, width: 0.8 };
/** G608: the far stand-ins' glow colour (the hologram graph's #46e6ff, lifted) and the far beams' width */
const GLOW = [0.35, 1, 1], FAR_BEAM = 3;

const ideas = JSON.parse(readFileSync(resolve(ROOT, 'outputs.json'), 'utf8')).outputs;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const yawPoint = (p, yaw, at) => [at[0] + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), at[1] + p[1], at[2] - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];

/** Plain triangle soup builder: positions, normals, colours, uvs, by material. */
class Soup {
  constructor() { this.parts = new Map(); }
  part(name) { let p = this.parts.get(name); if (p === undefined) { p = { positions: [], normals: [], colours: [], uvs: [] }; this.parts.set(name, p); } return p; }
  /** @param {string} name @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} [colour] @param {number[][] | null} [uv] */
  tri(name, a, b, c, colour = [1, 1, 1], uv = null) {
    const p = this.part(name), e1 = sub(b, a), e2 = sub(c, a), n = normalize(cross(e1, e2));
    for (const [i, v] of [a, b, c].entries()) { p.positions.push(...v); p.normals.push(...n); p.colours.push(...colour); p.uvs.push(...(uv === null ? [0, 0] : uv[i])); }
  }
  /** @param {string} name @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} d @param {number[]} [colour] @param {number[][] | null} [uv] */
  quad(name, a, b, c, d, colour, uv = null) { this.tri(name, a, b, c, colour, uv === null ? null : [uv[0], uv[1], uv[2]]); this.tri(name, a, c, d, colour, uv === null ? null : [uv[0], uv[2], uv[3]]); }
  /** an axis-aligned box from min to max, every face outward */
  box(name, min, max, colour) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    this.quad(name, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], colour);
    this.quad(name, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colour);
    this.quad(name, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour);
    this.quad(name, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour);
    this.quad(name, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour);
    this.quad(name, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour);
  }
}

/**
 * Make the generated mesh's winding consistent (image-to-3D output mixes it): walk each island across its two-face edges,
 * flipping a neighbour whose shared edge runs the same way, then turn an island inside out when its signed volume is
 * negative. Smooth normals and the crease test both read the winding.
 */
function orient(triangles, points, id, edges) {
  const flip = new Uint8Array(triangles.length), seen = new Uint8Array(triangles.length);
  const runs = (f, a, b) => { const t = triangles[f], at = t.findIndex(v => id[v] === a); return id[t[(at + 1) % 3]] === b; };
  for (let seed = 0; seed < triangles.length; seed++) {
    if (seen[seed] === 1) continue;
    const island = [seed], queue = [seed]; seen[seed] = 1;
    while (queue.length > 0) {
      const f = queue.pop(), t = triangles[f];
      for (let c = 0; c < 3; c++) {
        const a = id[t[c]], b = id[t[(c + 1) % 3]], faces = edges.get(a < b ? `${a}/${b}` : `${b}/${a}`) ?? [];
        if (faces.length !== 2) continue;
        const g = faces[0] === f ? faces[1] : faces[0];
        if (g === undefined || seen[g] === 1) continue;
        // as f is drawn, it runs a→b (or b→a when flipped); g must run the other way
        const forward = flip[f] === 0, gRuns = runs(g, a, b);
        flip[g] = (forward === gRuns) ? 1 : 0;
        seen[g] = 1; island.push(g); queue.push(g);
      }
    }
    let volume = 0;
    for (const f of island) {
      const [i, j, k] = flip[f] === 1 ? [triangles[f][0], triangles[f][2], triangles[f][1]] : triangles[f];
      const p = points[i], q = points[j], r = points[k];
      volume += p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0]);
    }
    if (volume < 0) for (const f of island) flip[f] ^= 1;
  }
  triangles.forEach((t, f) => { if (flip[f] === 1) [t[1], t[2]] = [t[2], t[1]]; });
}

/** The hologram's triangles (metres, base centre at the origin) with smooth normals and the edge-coded colours. */
async function hologram(file) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file), points = [], triangles = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (mesh === null) continue;
    const world = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION'), index = primitive.getIndices(), base = points.length, v = [];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        points.push([world[0] * v[0] + world[4] * v[1] + world[8] * v[2] + world[12], world[1] * v[0] + world[5] * v[1] + world[9] * v[2] + world[13], world[2] * v[0] + world[6] * v[1] + world[10] * v[2] + world[14]]);
      }
      const count = index === null ? position.getCount() : index.getCount();
      for (let i = 0; i < count; i += 3) triangles.push([0, 1, 2].map(k => base + (index === null ? i + k : index.getScalar(i + k))));
    }
  }
  // weld by position so creases are found across split vertices
  const key = (p) => p.map(c => Math.round(c * 1e4)).join(','), welded = new Map(), id = points.map(p => { const k = key(p); if (!welded.has(k)) welded.set(k, welded.size); return welded.get(k); });
  const edges = new Map();
  triangles.forEach((t, f) => { for (let c = 0; c < 3; c++) { const a = id[t[(c + 1) % 3]], b = id[t[(c + 2) % 3]], k = a < b ? `${a}/${b}` : `${b}/${a}`; const list = edges.get(k) ?? []; list.push(f); edges.set(k, list); } });
  orient(triangles, points, id, edges);
  const faceNormal = triangles.map(t => normalize(cross(sub(points[t[1]], points[t[0]]), sub(points[t[2]], points[t[0]]))));
  const limit = Math.cos(FEATURE_DEGREES * Math.PI / 180);
  const vertexNormal = new Map();
  triangles.forEach((t, f) => { const n = faceNormal[f]; for (const v of t) { const s = vertexNormal.get(id[v]) ?? [0, 0, 0]; vertexNormal.set(id[v], [s[0] + n[0], s[1] + n[1], s[2] + n[2]]); } });
  return triangles.map((t, f) => {
    const feature = [0, 1, 2].map(c => {
      const a = id[t[(c + 1) % 3]], b = id[t[(c + 2) % 3]], faces = edges.get(a < b ? `${a}/${b}` : `${b}/${a}`) ?? [];
      if (faces.length !== 2) return true;
      const [f0, f1] = faces, n0 = faceNormal[f0], n1 = faceNormal[f1];
      return n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < limit;
    });
    return t.map((v, corner) => ({ p: points[v], n: normalize(vertexNormal.get(id[v]) ?? faceNormal[f]),
      c: [0, 1, 2].map(i => (feature[i] ? 0 : 0.5) + (i === corner ? 0.5 : 0)) }));
  });
}

/** sRGB hex to linear RGB */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/**
 * G608: the far-only stand-ins (the source's `far_` nodes, which only the far proxy draws): the hologram
 * welded by position and indexed (so the far bake can simplify it into the far budget) and a glowing box up each beam.
 */
async function farStandIns(holo) {
  const positions = [], index = [], seen = new Map();
  for (const triangle of holo) for (const v of triangle) {
    const p = [-v.p[0] * PLOT.hologramScale, v.p[1] * PLOT.hologramScale + PLINTH.height + 0.02, -v.p[2] * PLOT.hologramScale];
    const key = p.map(c => Math.round(c * 1e3)).join(',');
    let at = seen.get(key); if (at === undefined) { at = positions.length / 3; seen.set(key, at); positions.push(...p); }
    index.push(at);
  }
  // simplified here to the row's triangle count (the far ring's budget is shared by every cell's proxy)
  await MeshoptSimplifier.ready;
  const simplified = MeshoptSimplifier.simplify(new Uint32Array(index), new Float32Array(positions), 3, PLOT.farHologramTriangles * 3, 1, ['LockBorder']);
  const beams = new Soup(), { at: corner, band, bands, beam } = BEACON, y0 = band * bands + 0.5, half = FAR_BEAM / 2;
  for (const [x, z] of [[-corner, -corner], [corner, -corner], [corner, corner], [-corner, corner]]) beams.box('Glow', [x - half, y0, z - half], [x + half, beam, z + half], [1, 1, 1]);
  return { hologram: { positions, index: Array.from(simplified[0]) }, beams: beams.part('Glow') };
}

async function plot(idea) {
  const assets = resolve(REPO, 'public/assets/open-plots', idea.idea), soup = new Soup();
  // the floor: a grid of 25 m quads, the four avenues and the plaza lighter than the field
  const shade = (x, z) => Math.hypot(x, z) < 36 ? [0.86, 0.9, 0.96] : Math.abs(x) < 6 || Math.abs(z) < 6 ? [0.74, 0.8, 0.88] : [0.58, 0.64, 0.74];
  for (let x = -250; x < 250; x += FLOOR_STEP) for (let z = -250; z < 250; z += FLOOR_STEP) {
    soup.quad('Floor', [x, 0, z], [x, 0, z + FLOOR_STEP], [x + FLOOR_STEP, 0, z + FLOOR_STEP], [x + FLOOR_STEP, 0, z], shade(x + FLOOR_STEP / 2, z + FLOOR_STEP / 2));
  }
  // the kerb around the plot, broken at the middle of each side by an entry
  const kerb = [0.8, 0.84, 0.9], { inner, outer, height, gap } = KERB, kerbs = [];
  for (const side of [-1, 1]) {
    kerbs.push([[-outer, 0, side > 0 ? inner : -outer], [-gap, height, side > 0 ? outer : -inner]], [[gap, 0, side > 0 ? inner : -outer], [outer, height, side > 0 ? outer : -inner]]);
    kerbs.push([[side > 0 ? inner : -outer, 0, -inner], [side > 0 ? outer : -inner, height, -gap]], [[side > 0 ? inner : -outer, 0, gap], [side > 0 ? outer : -inner, height, inner]]);
  }
  for (const [min, max] of kerbs) soup.box('Kerb', min, max, kerb);
  // the corner beacons: white-and-orange striped posts, a cyan cap and two crossed beam quads (a tall one and its twin)
  const { at: corner, half: post, band, bands, beam, twin, width } = BEACON, postTop = band * bands;
  for (const [x, z] of [[-corner, -corner], [corner, -corner], [corner, corner], [-corner, corner]]) {
    for (let k = 0; k < bands; k++) soup.box('Frame', [x - post, k * band, z - post], [x + post, (k + 1) * band, z + post], k % 2 === 0 ? [0.91, 0.93, 0.94] : [1, 0.48, 0.1]);
    soup.box('Rim', [x - post - 0.15, postTop, z - post - 0.15], [x + post + 0.15, postTop + 0.5, z + post + 0.15]);
    for (const [dx, beamTop] of [[0, beam], [0.5, twin]]) {
      const bx = x - Math.sign(x) * dx, half = width / 2, y0 = postTop + 0.5;
      soup.quad('Beam', [bx - half, y0, z], [bx + half, y0, z], [bx + half, beamTop, z], [bx - half, beamTop, z]);
      soup.quad('Beam', [bx, y0, z - half], [bx, y0, z + half], [bx, beamTop, z + half], [bx, beamTop, z - half]);
    }
  }
  // the plinth: a low drum and its glowing rim
  const { radius, rim, segments } = PLINTH, top = PLINTH.height, ring = (r, i, y) => [r * Math.sin(i / segments * Math.PI * 2), y, r * Math.cos(i / segments * Math.PI * 2)];
  for (let i = 0; i < segments; i++) {
    soup.quad('Plinth', ring(radius, i, 0), ring(radius, i + 1, 0), ring(radius, i + 1, top), ring(radius, i, top), [0.16, 0.24, 0.3]);
    soup.tri('Plinth', [0, top, 0], ring(radius - rim, i, top), ring(radius - rim, i + 1, top), [0.1, 0.2, 0.26]);
    soup.quad('Rim', ring(radius - rim, i, top + 0.01), ring(radius, i, top + 0.01), ring(radius, i + 1, top + 0.01), ring(radius - rim, i + 1, top + 0.01), [1, 1, 1]);
  }
  // the billboard: the picture facing the plinth (south, -Z) in a dark frame on two posts
  const b = BILLBOARD, left = -b.width / 2, right = b.width / 2, low = b.bottom, high = b.bottom + b.height;
  soup.quad('Billboard', [right, low, b.z], [left, low, b.z], [left, high, b.z], [right, high, b.z], [1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  soup.box('Frame', [left - 0.4, low - 0.4, b.z + 0.02], [right + 0.4, high + 0.4, b.z + b.depth], [0.12, 0.14, 0.18]);
  for (const x of [-8, 8]) soup.box('Frame', [x - 0.35, 0, b.z + 0.05], [x + 0.35, low - 0.4, b.z + b.depth - 0.05], [0.12, 0.14, 0.18]);
  // the sign: its board turned a little toward the south entry, on two posts
  const s = SIGN, at = [s.x, 0, s.z], w = s.width / 2, sLow = s.bottom, sHigh = s.bottom + s.height;
  soup.quad('Sign', yawPoint([w, sLow, 0], s.yaw, at), yawPoint([-w, sLow, 0], s.yaw, at), yawPoint([-w, sHigh, 0], s.yaw, at), yawPoint([w, sHigh, 0], s.yaw, at), [1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  const back = (px, py, pz) => yawPoint([px, py, pz], s.yaw, at);
  const signBox = (x0, y0, z0, x1, y1, z1) => {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(p => back(...p)), q = (i, j, k, l) => soup.quad('Frame', c[i], c[j], c[k], c[l], [0.12, 0.14, 0.18]);
    q(4, 5, 6, 7); q(1, 0, 3, 2); q(0, 4, 7, 3); q(5, 1, 2, 6); q(3, 7, 6, 2); q(0, 1, 5, 4);
  };
  signBox(-w - 0.2, sLow - 0.2, 0.02, w + 0.2, sHigh + 0.2, 0.25);
  signBox(-w + 0.6, 0, 0.05, -w + 1, sLow - 0.2, 0.22); signBox(w - 1, 0, 0.05, w - 0.6, sLow - 0.2, 0.22);
  // the hologram on the plinth, its front turned to the south entry (it turns anyway)
  const holo = await hologram(resolve(assets, 'hologram.glb')), holoPart = soup.part('Hologram'), k = PLOT.hologramScale;
  for (const triangle of holo) for (const v of triangle) {
    holoPart.positions.push(-v.p[0] * k, v.p[1] * k + top + 0.02, -v.p[2] * k); holoPart.normals.push(-v.n[0], v.n[1], -v.n[2]); holoPart.colours.push(...v.c); holoPart.uvs.push(0, 0);
  }
  return { soup, assets, kerbs, far: await farStandIns(holo) };
}

async function writeWorld(idea, { soup, assets, kerbs, far }) {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('plot');
  const png = async (file) => writeImagePixels(await readImagePixels(readFileSync(file)));
  const texture = async (name, file) => doc.createTexture(name).setImage(await png(file)).setMimeType('image/png');
  const materials = {
    // G608: the survey floor's blue mixed toward the idea's accent
    Floor: doc.createMaterial('Floor').setBaseColorFactor([...[0.05, 0.16, 0.26].map((c, i) => c + ((linear(ACCENTS[idea.accent])[i] ?? c) * 0.4 - c) * PLOT.floorTint), 1]).setRoughnessFactor(1).setMetallicFactor(0),
    Kerb: doc.createMaterial('Kerb').setBaseColorFactor([0.5, 0.56, 0.64, 1]).setRoughnessFactor(1).setMetallicFactor(0),
    Plinth: doc.createMaterial('Plinth').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.8).setMetallicFactor(0),
    Rim: doc.createMaterial('Rim').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0),
    Frame: doc.createMaterial('Frame').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.7).setMetallicFactor(0),
    Billboard: doc.createMaterial('Billboard').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setBaseColorTexture(await texture('billboard', resolve(assets, 'billboard.webp'))),
    Sign: doc.createMaterial('Sign').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setBaseColorTexture(await texture('sign', resolve(assets, 'sign.webp'))),
    Hologram: doc.createMaterial('Hologram').setBaseColorFactor([0.1, 0.45, 0.55, 1]).setMetallicFactor(0),
    Beam: doc.createMaterial('Beam').setBaseColorFactor([0.27, 0.9, 1, 1]).setMetallicFactor(0),
    // G608: the far stand-ins' glow (the far proxy only)
    Glow: doc.createMaterial('Glow').setBaseColorFactor([...GLOW, 1]).setRoughnessFactor(1).setMetallicFactor(0),
  };
  for (const [, material] of Object.entries(materials)) if (material.getBaseColorTexture() !== null) {
    material.getBaseColorTextureInfo()?.setWrapS(33071).setWrapT(33071).setMinFilter(9987).setMagFilter(9729);
  }
  const accessor = (values, type) => doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
  // G608: each part welded (corners that share position, normal, colour and uv become one indexed vertex), so the far
  // bake can simplify the flat floor, kerb and plinth into the far budget; the drawn triangles are the same
  const node = (name, part, material, uv) => {
    const welded = { positions: [], normals: [], colours: [], uvs: [] }, index = [], seen = new Map();
    for (let i = 0; i < part.positions.length / 3; i++) {
      const corner = [part.positions.slice(i * 3, i * 3 + 3), part.normals.slice(i * 3, i * 3 + 3), part.colours.slice(i * 3, i * 3 + 3), part.uvs.slice(i * 2, i * 2 + 2)];
      const key = corner.flat().map(c => Math.round(c * 1e4)).join(',');
      let at = seen.get(key);
      if (at === undefined) { at = seen.size; seen.set(key, at); welded.positions.push(...corner[0]); welded.normals.push(...corner[1]); welded.colours.push(...corner[2]); welded.uvs.push(...corner[3]); }
      index.push(at);
    }
    const primitive = doc.createPrimitive().setMaterial(material).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer))
      .setAttribute('POSITION', accessor(welded.positions, 'VEC3')).setAttribute('NORMAL', accessor(welded.normals, 'VEC3')).setAttribute('COLOR_0', accessor(welded.colours, 'VEC3'));
    if (uv) primitive.setAttribute('TEXCOORD_0', accessor(welded.uvs, 'VEC2'));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  };
  for (const [name, part] of soup.parts) node(name === 'Floor' ? 'ws_terrain_floor' : `draw_${name.toLowerCase()}`, part, materials[name], name === 'Billboard' || name === 'Sign');
  // G608: the far-only stand-ins (shard.config's `far: 'far_'`): the welded hologram and the beam boxes, in the glow
  const indexed = doc.createPrimitive().setMaterial(materials.Glow).setAttribute('POSITION', accessor(far.hologram.positions, 'VEC3'))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(far.hologram.index)).setBuffer(buffer));
  scene.addChild(doc.createNode('far_hologram').setMesh(doc.createMesh('far_hologram').addPrimitive(indexed)));
  node('far_beams', far.beams, materials.Glow, false);
  // collision: the floor, the kerb, the beacon posts, the plinth drum, the billboard and the sign (never the hologram,
  // the rim or a beam)
  const solid = new Soup();
  solid.quad('Solid', [-250, 0, -250], [-250, 0, 250], [250, 0, 250], [250, 0, -250]);
  for (const [min, max] of kerbs) solid.box('Solid', min, max);
  const { at: corner, half: post } = BEACON, postTop = BEACON.band * BEACON.bands + 0.5;
  for (const [x, z] of [[-corner, -corner], [corner, -corner], [corner, corner], [-corner, corner]]) solid.box('Solid', [x - post, 0, z - post], [x + post, postTop, z + post]);
  const steps = 24, top = PLINTH.height, r = PLINTH.radius, ring = (i, y) => [r * Math.sin(i / steps * Math.PI * 2), y, r * Math.cos(i / steps * Math.PI * 2)];
  for (let i = 0; i < steps; i++) { solid.quad('Solid', ring(i, 0), ring(i + 1, 0), ring(i + 1, top), ring(i, top)); solid.tri('Solid', [0, top, 0], ring(i, top), ring(i + 1, top)); }
  const b = BILLBOARD;
  solid.box('Solid', [-b.width / 2 - 0.4, b.bottom - 0.4, b.z], [b.width / 2 + 0.4, b.bottom + b.height + 0.4, b.z + b.depth]);
  for (const x of [-8, 8]) solid.box('Solid', [x - 0.35, 0, b.z], [x + 0.35, b.bottom, b.z + b.depth]);
  const s = SIGN, w = s.width / 2, c = [[-w, 0, 0], [w, 0, 0], [w, s.bottom + s.height + 0.2, 0], [-w, s.bottom + s.height + 0.2, 0], [-w, 0, 0.3], [w, 0, 0.3], [w, s.bottom + s.height + 0.2, 0.3], [-w, s.bottom + s.height + 0.2, 0.3]].map(p => yawPoint(p, s.yaw, [s.x, 0, s.z]));
  for (const [i, j, k, l] of [[4, 5, 6, 7], [1, 0, 3, 2], [0, 4, 7, 3], [5, 1, 2, 6], [3, 7, 6, 2], [0, 1, 5, 4]]) solid.quad('Solid', c[i], c[j], c[k], c[l]);
  node('collide_plot', solid.part('Solid'), materials.Kerb, false);
  const io = new NodeIO(), bytes = await io.writeBinary(doc), out = resolve(ROOT, 'assets', idea.idea);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'world.glb'), bytes);
  console.info(`open-plots: ${idea.slug} world.glb ${bytes.length} bytes, hologram ${soup.part('Hologram').positions.length / 9} triangles`);
}

// One world per idea row, then each output's data map from its own world (every world first: the map hash reads them all).
for (const idea of ideas) await writeWorld(idea, await plot(idea));
for (const idea of ideas) await paintDataMap(REPO, 'open-plots', { output: idea.slug, glbs: [`assets/${idea.idea}/world.glb`] });
