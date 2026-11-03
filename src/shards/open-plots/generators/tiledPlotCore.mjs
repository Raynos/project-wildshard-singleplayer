// G641 / G633 (Night Market pilot NM1-NM3): a tiled open plot's world GLB. Its idea row names a layout
// (data/layouts/<layout>.json: the 8 x 8 tile rows, the palette, the landmark and the posters); the tiles are the kit's
// (kit.mjs), the landmark is the idea's generated model (opaque and painted, scaled to its height at the plaza's centre),
// and five posters (the idea's hero picture, its name and BUILD THIS SHARD) stand on the plaza and over the four entries.
//
// Parts and materials: `Paving` (the plot's outer ring: the edges are sampled from it), `Kit` (lit, vertex colours: the
// tiles' paving, buildings, stalls, canals, trees and the kerb), `Glow` (emissive: lanterns and windows), `Landmark` (its own
// texture) and `Poster` (the poster picture, lit). The far proxy is the far-only nodes alone (the source's `farMode:
// 'replace'`): each tile's stand-in, the landmark's far model in its texture's colours and the boards. Collision is
// `collide_plot`: the floor, the kit's boxes, the kerb, the boards' posts and the landmark's far model.
import { bakeLanternVertices, buildLayout, parseLayout, paving, Soup, waterStreaks } from './kit.mjs';
import { prepareModelKit } from './kitGlb.mjs';


/** sRGB hex to linear RGB */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** the plot's outer ring (m): the kerb stands in it and the edges sample it */
const RING = 246.25;
const KERB = { from: 247, to: 248.6, height: 0.5, gap: 7.5 };

/** A generated model's triangles in metres (its node transforms applied), with normals, uvs and its colour texture. */
async function readModel(bytes, codec) {
  const { WebIO, ALL_EXTENSIONS, MeshoptDecoder } = codec;
  await MeshoptDecoder.ready;
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(bytes), corners = [];
  let image = null;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (mesh === null) continue;
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      image ??= primitive.getMaterial()?.getBaseColorTexture()?.getImage() ?? null;
      const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL'), uv = primitive.getAttribute('TEXCOORD_0'), index = primitive.getIndices();
      if (position === null || uv === null) throw new Error(`open-plots: model ${file} needs positions and uvs`);
      const count = index === null ? position.getCount() : index.getCount(), p = [], n = [0, 1, 0], t = [];
      for (let i = 0; i < count; i++) {
        const at = index === null ? i : index.getScalar(i);
        position.getElement(at, p); uv.getElement(at, t); if (normal !== null) normal.getElement(at, n);
        const world = [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
        const turned = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]], l = Math.hypot(...turned) || 1;
        corners.push({ p: world, n: turned.map(c => c / l), uv: [t[0], t[1]] });
      }
    }
  }
  if (image === null) throw new Error(`open-plots: model ${file} has no colour texture`);
  return { corners, image };
}
/** Scale a model's corners to `height` m standing on y = 0 at the origin, turned `turn` quarter turns clockwise. */
function stand(corners, height, turn, reference) {
  const ys = reference.map(c => c.p[1]), xs = reference.map(c => c.p[0]), zs = reference.map(c => c.p[2]);
  const low = Math.min(...ys), k = height / (Math.max(...ys) - low), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const spin = ([x, y, z]) => { let a = x, b = z; for (let i = 0; i < turn; i++) [a, b] = [b, -a]; return [a, y, b]; };
  return corners.map(c => ({ p: spin([(c.p[0] - cx) * k, (c.p[1] - low) * k, (c.p[2] - cz) * k]), n: spin(c.n), uv: c.uv }));
}
/** The texture's colour at a uv (nearest texel, linear RGB). */
function sampler(image) {
  return ([u, v]) => {
    const x = Math.min(image.width - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * image.width))), y = Math.min(image.height - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * image.height)));
    const at = (y * image.width + x) * 4;
    return [toLinear((image.pixels[at] ?? 0) / 255), toLinear((image.pixels[at + 1] ?? 0) / 255), toLinear((image.pixels[at + 2] ?? 0) / 255)];
  };
}

/** A picture's mean colour (linear RGB). */
async function meanColour(tools, bytes) {
  const image = await tools.readImagePixels(bytes), sum = [0, 0, 0], n = image.width * image.height;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) sum[k] += toLinear((image.pixels[i * 4 + k] ?? 0) / 255);
  return sum.map(c => c / n);
}

/** A poster board: the picture on both faces of a framed board on two posts, lamps over its face; `n` faces out, `offset`
 *  moves it along its face (an entry's board stands beside the lane: an entry's footprint stays clear above the road). */
function poster(parts, palette, { centre, n, width, bottom, posts, offset = 0 }, lanterns) {
  const height = width * 9 / 16, depth = 0.4, r = [-n[2], 0, n[0]], top = bottom + height;
  const at = (s, y, d) => [centre[0] + r[0] * (s + offset) + n[0] * d, y, centre[1] + r[2] * (s + offset) + n[2] * d];
  const face = (d, out) => {
    const sign = out ? 1 : -1, rr = (s) => s * sign;
    const p = parts.Poster;
    // u runs left to right as the face is seen from outside it (each face reads, not mirrored)
    const corners = [[at(rr(width / 2), bottom, d), [0, 1]], [at(rr(-width / 2), bottom, d), [1, 1]], [at(rr(-width / 2), top, d), [1, 0]], [at(rr(width / 2), top, d), [0, 0]]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) p.tri('Poster', corners[a][0], corners[b][0], corners[c][0], palette.picture, [corners[a][1], corners[b][1], corners[c][1]]);
  };
  face(depth / 2 + 0.02, true); face(-depth / 2 - 0.02, false);
  const box = (part, s0, y0, d0, s1, y1, d1, colour) => {
    const a = at(s0, y0, d0), b = at(s1, y1, d1);
    const min = [Math.min(a[0], b[0]), y0, Math.min(a[2], b[2])], max = [Math.max(a[0], b[0]), y1, Math.max(a[2], b[2])];
    parts[part].box(part, min, max, colour); return [min, max];
  };
  box('Kit', -width / 2 - 0.35, bottom - 0.35, -depth / 2, width / 2 + 0.35, top + 0.35, depth / 2, palette.board);
  for (const s of [-posts, posts]) { const [min, max] = box('Kit', s - 0.2, 0, -0.2, s + 0.2, bottom, 0.2, palette.board); parts.solid.box('Solid', min, max); }
  for (const s of [-width / 3, 0, width / 3]) {
    box('Glow', s - 0.4, top + 0.35, depth / 2, s + 0.4, top + 0.65, depth / 2 + 0.8, palette.lantern);
    lanterns.push({ at: at(s, top + 0.5, depth / 2 + 0.4), colour: [...palette.lantern] });
  }
  // the far proxy's board: its frame in the board's colour, a lit middle
  box('far', -width / 2, bottom, -depth / 2, width / 2, top, depth / 2, palette.board);
}


/** The layout's poster boards (poster()'s rows): the plaza's facing the south entry, one over each entry facing out to the road. */
function boards(posters) {
  if (posters === null) return [];
  const { plaza, entry } = posters, out = [];
  // a plot whose landmark fills the plaza (Lantern Bayou's cypress) may stand no plaza poster (`plaza: null`)
  if (plaza !== null) out.push({ centre: [plaza.x, plaza.z], n: [0, 0, -1], width: plaza.width, bottom: plaza.bottom, posts: plaza.width / 3, offset: plaza.offset ?? 0 });
  for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]]) out.push({ centre: [n[0] * entry.inset, n[2] * entry.inset], n, width: entry.width, bottom: entry.bottom, posts: entry.posts, offset: entry.offset });
  return out;
}
/** OP26 (Jake 11-03, art/open-plots/billboard-review-2026-11-03): no model stands in front of or behind a board's picture
 *  (as wide as the board, `face` m off either face: both carry it) or within `side` m of its frame's ends and edges (`near`
 *  m deep). Beside the picture, past `near`, models stay: Mosslight's south avenue arch spans the lane 8 m before the plaza
 *  board's end and frames the tower. */
const KEEP_OUT = { side: 4, near: 1.5, face: 8 };
/** A board's keep-outs, [x0, z0, x1, z1] in plot metres: the strips before and behind its picture, and the frame's margin. */
function keepOuts({ centre, n, width, offset }) {
  const r = [-n[2], n[0]], half = width / 2 + 0.35, rect = (s0, s1, d) => {
    const xs = [], zs = [];
    for (const s of [s0, s1]) for (const k of [-d, d]) { xs.push(centre[0] + r[0] * s + n[0] * k); zs.push(centre[1] + r[1] * s + n[2] * k); }
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  };
  return [rect(offset - half, offset + half, 0.6 + KEEP_OUT.face), rect(offset - half - KEEP_OUT.side, offset + half + KEEP_OUT.side, 0.6 + KEEP_OUT.near)];
}

/** A JSON input's value, from its bytes. */
const json = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

/** Build a tiled idea's world: { parts, image textures } ready for the writer. GR9: every input arrives through
 *  `read(path)` (a repo-relative path: the build program's declared, cached inputs), so this module opens no file. */
async function tiledPlot(read, tools, layoutName, plot, codec, litCoarse = false, streaks = false) {
  const layout = json(read(`src/shards/open-plots/data/layouts/${layoutName}.json`));
  const palette = Object.fromEntries(Object.entries(layout.palette).map(([key, hex]) => [key, linear(hex)]));
  // NM5: the posters' faces carry their picture's mean colour (the Poster material draws the picture alone), for the near view
  palette.picture = layout.posters === null ? [1, 1, 1] : await meanColour(tools, read(layout.posters.image));
  const builders = plot.builders(layout), LANTERN_BAKE = plot.lanternBake;
  const grid = parseLayout(layout.rows, builders), parts = { Paving: new Soup(), Kit: new Soup(), Water: new Soup(), Glow: new Soup(), Pool: new Soup(), Poster: new Soup(), far: new Soup(), solid: new Soup(), detailKit: new Soup(), detailGlow: new Soup(), coarse: new Soup(), standIns: new Soup() };
  // the plot's ground: the outer ring, then each tile's paving inside it (the lanes a shade lighter, the canals open)
  for (const [x0, z0, x1, z1] of [[-250, RING, 250, 250], [-250, -250, 250, -RING], [-250, -RING, -RING, RING], [RING, -RING, 250, RING]]) {
    parts.Paving.quad('Paving', [x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], palette.paving);
  }
  // NM8 / RM5.1: the paving in 10 m slabs on the plot's grid, each its region's colour (the lanes their own), in the kit's
  // draw (a tile holds 8); the kit material rules every up-facing ground-level face as flagstones (data/trim.json)
  const SLAB = 10, cut = (a0, a1) => { const out = [a0]; for (let v = Math.ceil(a0 / SLAB) * SLAB; v < a1; v += SLAB) if (v > a0) out.push(v); out.push(a1); return out; };
  for (const [x0, z0, x1, z1, lane] of paving(grid, RING, builders)) {
    const xs = cut(x0, x1), zs = cut(z0, z1), colour = lane ? palette.lane : palette.paving;
    for (let i = 0; i + 1 < xs.length; i++) for (let k = 0; k + 1 < zs.length; k++) {
      parts.Kit.quad('Kit', [xs[i], 0, zs[k]], [xs[i], 0, zs[k + 1]], [xs[i + 1], 0, zs[k + 1]], [xs[i + 1], 0, zs[k]], colour);
    }
  }
  // the kerb in the ring, open at the four entries (the lanes on the x = 0 and z = 0 seams)
  for (const side of [-1, 1]) for (const [a, b] of [[-KERB.to, -KERB.gap], [KERB.gap, KERB.to]]) {
    const along = [[a, side * KERB.from], [b, side * KERB.to]], across = [[side * KERB.from, a], [side * KERB.to, b]];
    for (const [[x0, z0], [x1, z1]] of [along, across]) {
      const min = [Math.min(x0, x1), 0, Math.min(z0, z1)], max = [Math.max(x0, x1), KERB.height, Math.max(z0, z1)];
      parts.Kit.box('Kit', min, max, palette.kerb); parts.solid.box('Solid', min, max);
    }
  }
  // the tiles; H and G pick their variant from the tile's place
  // RM4: the kit's Blender models (scripts/blender/open-plots/kit.py), retinted by this layout's palette
  // RM4: the layout's kit families (data/layouts/<layout>.json `kit`, each public/assets/open-plots/kit/<family>.glb);
  // Night Market's switched on with RM8.6 once RM8.1's quantized tiles and RM8.2's L0-only detail paid for them
  const files = new Map((layout.kit ?? []).map(family => [family, read(`public/assets/open-plots/kit/${family}.glb`)]));
  const lanterns = [], kit = files.size === 0 ? {} : await prepareModelKit(palette, files, tools.normalizeWorldGlb);
  // OP26: the boards are known before the tiles, so every model the tiles and the plot place keeps out of their keep-outs
  const posters = boards(layout.posters), zones = posters.flatMap(keepOuts), leftOut = [];
  buildLayout(grid, parts, palette, (r, c) => (r * 7 + c * 3) % 2,
    { ...kit, keepOut: zones, leftOut, lanternEmitter: (at, colour) => lanterns.push({ at, colour }) }, builders);
  if (layout.landmark !== null) plot.models(parts, { ...kit, keepOut: zones, leftOut, lanternEmitter: (at, colour) => lanterns.push({ at, colour }) }, layout);
  if (leftOut.length > 0) console.info(`open-plots: ${layoutName} poster keep-out left out ${leftOut.length} models: ${[...new Set(leftOut)].join(', ')}`);
  // a pool at the plot's edge (an entry forecourt's lanterns) keeps to the cell: its rim (black, it adds nothing) stops at it
  const pools = parts.Pool.part('Pool').positions, EDGE = 249.5;
  for (let i = 0; i < pools.length; i += 3) for (const k of [0, 2]) pools[i + k] = Math.max(-EDGE, Math.min(EDGE, pools[i + k] ?? 0));
  for (const board of posters) poster(parts, palette, board, lanterns);
  plot.pools(parts, palette);
  // OB2: a row's `pool: "streaks"` mirrors its low lanterns in the water nearby (kit.mjs waterStreaks, in the Pool's draw)
  if (streaks) console.info(`open-plots: ${layoutName} water streaks: ${waterStreaks(parts.Pool, parts.Water.part('Water'), lanterns)}`);
  // the landmark: its near model as drawn, its far model in its texture's colours (far only, and the collider)
  const landmark = { positions: [], normals: [], colours: [], uvs: [] }, farLandmark = { positions: [], normals: [], colours: [] };
  let nearImage = null;
  if (layout.landmark !== null) {
    const near = await readModel(read(layout.landmark.near), codec), far = await readModel(read(layout.landmark.far), codec);
    const placed = stand(near.corners, layout.landmark.height, layout.landmark.turn, near.corners);
    const farPlaced = stand(far.corners, layout.landmark.height, layout.landmark.turn, far.corners);
    nearImage = await tools.readImagePixels(near.image);
    const farImage = await tools.readImagePixels(far.image), colourOf = sampler(farImage), nearColourOf = sampler(nearImage);
    // NM5: its vertex colours are its texture's (the Landmark material draws the texture alone), for the near view and the map
    for (const c of placed) { landmark.positions.push(...c.p); landmark.normals.push(...c.n); landmark.colours.push(...nearColourOf(c.uv)); landmark.uvs.push(...c.uv); }
    for (const c of farPlaced) { farLandmark.positions.push(...c.p); farLandmark.normals.push(...c.n); farLandmark.colours.push(...colourOf(c.uv)); }
    for (let i = 0; i < farPlaced.length; i += 3) {
      const [a, b, c] = farPlaced.slice(i, i + 3);
      if (a !== undefined && b !== undefined && c !== undefined) parts.solid.tri('Solid', a.p, b.p, c.p);
    }
  }
  // the floor everyone walks on (the canals' water sits below it, behind their rims)
  parts.solid.quad('Solid', [-250, 0, -250], [-250, 0, 250], [250, 0, 250], [250, 0, -250]);
  // RM6.3: each lantern warms the kit within a few metres (Nine's compact falloff into the vertex colours: the posts,
  // eaves, stall fronts and walls round it), so a lantern visibly lights what it hangs on
  // RM6 owns visible light tuning; radius/cut give the existing 4.5 m post-pool reach.
  for (const [soup, name] of [[parts.Kit, 'Kit'], [parts.detailKit, 'detailKit'], [parts.coarse, 'coarse']]) {
    const surface = soup.part(name);
    surface.colours = bakeLanternVertices(surface, lanterns, { gain: LANTERN_BAKE.gain, radius: LANTERN_BAKE.radius, cut: LANTERN_BAKE.cut });
  }
  console.info(`open-plots: ${layoutName} lantern bake: ${lanterns.length} emitters, gain ${LANTERN_BAKE.gain}`);
  standIns(parts, farLandmark, linear(layout.palette.ring), litCoarse);
  return { parts, landmark, farLandmark, nearImage, poster: layout.posters === null ? null : read(layout.posters.image), ring: layout.palette.ring };
}

/**
 * T8 (tile caps: an L1 tile draws at most 2 render states): the water, posters, landmark, light pools and the ring's paving
 * draw only at L0 (`detail_`); at L1 they stand in on the kit's own material (`coarse_standins`), in their vertex colours:
 * the water's, the posters' picture colour (NM5), the landmark's far model in its texture's colours (lit by flat normals)
 * and the ring in its colour, so an L1 tile draws Kit and Glow alone and holds no texture. The pools add light only near;
 * L1 leaves them out.
 */
function standIns(parts, farLandmark, ring, litCoarse) {
  const out = parts.standIns.part('standIns');
  const add = (part, colour) => {
    out.positions.push(...part.positions); out.normals.push(...part.normals);
    if (colour === undefined) out.colours.push(...part.colours); else for (let i = 0; i < part.positions.length / 3; i++) out.colours.push(...colour);
    for (let i = 0; i < part.positions.length / 3; i++) out.uvs.push(0, 0);
  };
  const p = farLandmark.positions, normals = [];
  for (let i = 0; i + 8 < p.length; i += 9) {
    const e1 = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]], e2 = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) normals.push(n[0] / l, n[1] / l, n[2] / l);
  }
  add(parts.Water.part('Water')); add(parts.Poster.part('Poster'));
  // OB10: a self-lit coarse landmark draws in its own node (`coarse_landmark`), not among the kit's stand-ins
  if (!litCoarse) add({ positions: p, normals, colours: farLandmark.colours });
  add(parts.Paving.part('Paving'), ring);
}

/** GR9: a tiled idea's world GLB bytes, from inputs read through `read(path)`; nothing is written. */
export async function tiledPlotWorldBytes(read, tools, idea, plot, codec) {
  const { Document, WebIO } = codec;
  const litCoarse = idea.coarseLandmark === 'lit', streaks = idea.pool === 'streaks';
  const { parts, landmark, farLandmark, nearImage, poster: posterBytes, ring } = await tiledPlot(read, tools, idea.layout, plot, codec, litCoarse, streaks);
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('plot');
  const texture = async (name, pixels) => doc.createTexture(name).setImage(await tools.writeImagePixels(pixels)).setMimeType('image/png');
  const materials = {
    Paving: doc.createMaterial('Paving').setBaseColorFactor([...linear(ring), 1]).setRoughnessFactor(1).setMetallicFactor(0),
    Kit: doc.createMaterial('Kit').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0),
    Glow: doc.createMaterial('Glow').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0),
    Pool: doc.createMaterial('Pool').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0),
    Water: doc.createMaterial('Water').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.12).setMetallicFactor(0.2),
    Landmark: doc.createMaterial('Landmark').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.8).setMetallicFactor(0).setBaseColorTexture(nearImage === null ? null : await texture('landmark', nearImage)),
    // OB10: the coarse landmark in its landmark graph without a texture (meshMap colourOrVertex reads its vertex colours);
    // only a lit row has it, so another plot's world holds no material its template leaves unmapped
    LandmarkCoarse: litCoarse ? doc.createMaterial('LandmarkCoarse').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.8).setMetallicFactor(0) : null,
    Poster: doc.createMaterial('Poster').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setBaseColorTexture(posterBytes === null ? null : await texture('poster', await tools.readImagePixels(posterBytes))),
  };
  for (const material of [materials.Landmark, materials.Poster]) material.getBaseColorTextureInfo()?.setWrapS(33071).setWrapT(33071).setMinFilter(9987).setMagFilter(9729);
  const accessor = (values, type) => doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
  // each part welded (corners sharing position, normal, colour and uv become one indexed vertex); an empty part writes no
  // node (its interleaved view would be 0 bytes under accessor offsets the world reader refuses: Alien Plain has no water)
  const node = (name, part, material, { uv = false, normals = true, parent = scene } = {}) => {
    if (part.positions.length === 0) return;
    const welded = { positions: [], normals: [], colours: [], uvs: [] }, index = [], seen = new Map(), n = part.positions.length / 3;
    for (let i = 0; i < n; i++) {
      const corner = [part.positions.slice(i * 3, i * 3 + 3), normals ? part.normals.slice(i * 3, i * 3 + 3) : [], part.colours.slice(i * 3, i * 3 + 3), uv ? part.uvs.slice(i * 2, i * 2 + 2) : []];
      const key = corner.flat().map(c => Math.round(c * 1e4)).join(',');
      let at = seen.get(key);
      if (at === undefined) { at = seen.size; seen.set(key, at); welded.positions.push(...corner[0]); welded.normals.push(...corner[1]); welded.colours.push(...corner[2]); welded.uvs.push(...corner[3]); }
      index.push(at);
    }
    const primitive = doc.createPrimitive().setMaterial(material).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer))
      .setAttribute('POSITION', accessor(welded.positions, 'VEC3')).setAttribute('COLOR_0', accessor(welded.colours, 'VEC3'));
    if (normals) primitive.setAttribute('NORMAL', accessor(welded.normals, 'VEC3'));
    if (uv) primitive.setAttribute('TEXCOORD_0', accessor(welded.uvs, 'VEC2'));
    parent.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  };
  // T8: the ring's paving, the water, pools, posters and landmark draw only at L0 (their L1 stand-ins: `standIns`); the
  // ring stays the terrain's sampling surface under its `detail_` group
  const ringGroup = doc.createNode('detail_paving');
  scene.addChild(ringGroup);
  // a plot's `ringInKit` draws the ring in the kit's material (its ruled flagstones, the ring's colour in its vertices):
  // an edge tile then holds one render state fewer (T8: Lantern Bayou's edge tiles drew 9 > 8)
  const ringPart = parts.Paving.part('Paving'), ringInKit = plot.ringInKit === true, ringLinear = linear(ring);
  if (ringInKit) ringPart.colours = ringPart.colours.map((c, i) => c * (ringLinear[i % 3] ?? 1));
  node('ws_terrain_floor', ringPart, ringInKit ? materials.Kit : materials.Paving, { parent: ringGroup });
  node('draw_kit', parts.Kit.part('Kit'), materials.Kit);
  node('detail_water', parts.Water.part('Water'), materials.Water);
  node('draw_glow', parts.Glow.part('Glow'), materials.Glow);
  // a streaks row's pools carry uvs: the streak corners' (kit.mjs waterStreaks), 0 at every pool corner
  node('detail_pool', parts.Pool.part('Pool'), materials.Pool, { normals: false, uv: streaks });
  node('detail_poster', parts.Poster.part('Poster'), materials.Poster, { uv: true });
  node('detail_landmark', landmark, materials.Landmark, { uv: true });
  // RM8.2: the kit's models, full detail only (L0), and the big ones' boxes standing in for them in the coarse (L1) tiles
  node('detail_kit', parts.detailKit.part('detailKit'), materials.Kit);
  node('detail_glow', parts.detailGlow.part('detailGlow'), materials.Glow);
  node('coarse_kit', parts.coarse.part('coarse'), materials.Kit);
  node('coarse_standins', parts.standIns.part('standIns'), materials.Kit);
  // OB10: a row's `coarseLandmark: "lit"` draws its coarse landmark in its own landmark graph (`LandmarkCoarse`, no
  // texture: the graph shades its vertex colours as it shades the near model's texture)
  if (litCoarse) node('coarse_landmark', farLandmark, materials.LandmarkCoarse);
  // the far proxy's own nodes (far only): the tiles' stand-ins and boards, the landmark's far model
  node('far_tiles', parts.far.part('far'), materials.Kit, { normals: false });
  node('far_landmark', { ...farLandmark, normals: [], uvs: [] }, materials.Kit, { normals: false });
  node('collide_plot', { ...parts.solid.part('Solid'), colours: parts.solid.part('Solid').positions.map(() => 1) }, materials.Kit, { normals: false });
  const bytes = await new WebIO().writeBinary(doc);
  const count = (soup, name) => soup.part(name).positions.length / 9;
  console.info(`open-plots: ${idea.slug} world.glb ${bytes.length} bytes, tiled ${idea.layout}: kit ${count(parts.Kit, 'Kit')} glow ${count(parts.Glow, 'Glow')} pool ${count(parts.Pool, 'Pool')} landmark ${landmark.positions.length / 9} far ${count(parts.far, 'far') + farLandmark.positions.length / 9} triangles`);
  return bytes;
}
