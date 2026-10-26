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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';
import { bakeLanternVertices, buildLayout, parseLayout, paving, pool, Soup } from './kit.mjs';
import { prepareModelKit } from './kitGlb.mjs';

/** the kit's model families, each `public/assets/open-plots/kit/<family>.glb` */
const KIT_FAMILIES = ['lanterns'];

/** sRGB hex to linear RGB */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** the plot's outer ring (m): the kerb stands in it and the edges sample it */
const RING = 246.25;
const KERB = { from: 247, to: 248.6, height: 0.5, gap: 7.5 };

/** A generated model's triangles in metres (its node transforms applied), with normals, uvs and its colour texture. */
async function readModel(file) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file), corners = [];
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
async function meanColour(file) {
  const image = await readImagePixels(readFileSync(file)), sum = [0, 0, 0], n = image.width * image.height;
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

/** RM5: a kit face's trim band rides in its UV's u (data/trim.json: 32 m a band); the tiles' paving is the flagstone */
const TRIM = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/trim.json'), 'utf8'));
const FLAGSTONE_U = TRIM.band * TRIM.trims.flagstone.band;

/** Build a tiled idea's world: { parts, image textures } ready for the writer. */
async function tiledPlot(root, repo, layoutName) {
  const layout = JSON.parse(readFileSync(resolve(root, 'data/layouts', `${layoutName}.json`), 'utf8'));
  const palette = Object.fromEntries(Object.entries(layout.palette).map(([key, hex]) => [key, linear(hex)]));
  // NM5: the posters' faces carry their picture's mean colour (the Poster material draws the picture alone), for the near view
  palette.picture = await meanColour(resolve(repo, layout.posters.image));
  const grid = parseLayout(layout.rows), parts = { Paving: new Soup(), Kit: new Soup(), Water: new Soup(), Glow: new Soup(), Pool: new Soup(), Poster: new Soup(), far: new Soup(), solid: new Soup() };
  // the plot's ground: the outer ring, then each tile's paving inside it (the lanes a shade lighter, the canals open)
  for (const [x0, z0, x1, z1] of [[-250, RING, 250, 250], [-250, -250, 250, -RING], [-250, -RING, -RING, RING], [RING, -RING, 250, RING]]) {
    parts.Paving.quad('Paving', [x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], palette.paving);
  }
  // NM8 / RM5.1: the paving in 10 m slabs on the plot's grid, each its region's colour (the lanes their own), in the kit's
  // draw (a tile holds 8): its trim band is the flagstone, which the kit material rules in world metres (data/trim.json)
  const SLAB = 10, cut = (a0, a1) => { const out = [a0]; for (let v = Math.ceil(a0 / SLAB) * SLAB; v < a1; v += SLAB) if (v > a0) out.push(v); out.push(a1); return out; };
  for (const [x0, z0, x1, z1, lane] of paving(grid, RING)) {
    const xs = cut(x0, x1), zs = cut(z0, z1), colour = lane ? palette.lane : palette.paving, flagstone = [FLAGSTONE_U, 0];
    for (let i = 0; i + 1 < xs.length; i++) for (let k = 0; k + 1 < zs.length; k++) {
      parts.Kit.quad('Kit', [xs[i], 0, zs[k]], [xs[i], 0, zs[k + 1]], [xs[i + 1], 0, zs[k + 1]], [xs[i + 1], 0, zs[k]], colour, [flagstone, flagstone, flagstone, flagstone]);
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
  const files = new Map(KIT_FAMILIES.map(family => [family, new Uint8Array(readFileSync(resolve(repo, 'public/assets/open-plots/kit', `${family}.glb`)))]));
  const lanterns = [], kit = await prepareModelKit(palette, files);
  buildLayout(grid, parts, palette, (r, c) => (r * 7 + c * 3) % 2,
    { ...kit, lanternEmitter: (at, colour) => lanterns.push({ at, colour }) });
  // a pool at the plot's edge (an entry forecourt's lanterns) keeps to the cell: its rim (black, it adds nothing) stops at it
  const pools = parts.Pool.part('Pool').positions, EDGE = 249.5;
  for (let i = 0; i < pools.length; i += 3) for (const k of [0, 2]) pools[i + k] = Math.max(-EDGE, Math.min(EDGE, pools[i + k] ?? 0));
  // the posters: the plaza's facing the south entry, one over each entry facing out to the road
  const { plaza, entry } = layout.posters;
  poster(parts, palette, { centre: [plaza.x, plaza.z], n: [0, 0, -1], width: plaza.width, bottom: plaza.bottom, posts: plaza.width / 3, offset: plaza.offset ?? 0 }, lanterns);
  for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]]) poster(parts, palette, { centre: [n[0] * entry.inset, n[2] * entry.inset], n, width: entry.width, bottom: entry.bottom, posts: entry.posts, offset: entry.offset }, lanterns);
  // NM7: the gate uplit: warm pools round its feet and one wide one under it (the Pool material adds their light)
  const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
  pool(plotWriter, 0, 0, 30, palette.gatePool, 0.09);
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; pool(plotWriter, 16 * Math.sin(a), 16 * Math.cos(a), 10, palette.gatePool, 0.1); }
  // the landmark: its near model as drawn, its far model in its texture's colours (far only, and the collider)
  const near = await readModel(resolve(repo, layout.landmark.near)), far = await readModel(resolve(repo, layout.landmark.far));
  const placed = stand(near.corners, layout.landmark.height, layout.landmark.turn, near.corners);
  const farPlaced = stand(far.corners, layout.landmark.height, layout.landmark.turn, far.corners);
  const nearImage = await readImagePixels(near.image), farImage = await readImagePixels(far.image), colourOf = sampler(farImage), nearColourOf = sampler(nearImage);
  // NM5: its vertex colours are its texture's (the Landmark material draws the texture alone), for the near view and the map
  const landmark = { positions: [], normals: [], colours: [], uvs: [] };
  for (const c of placed) { landmark.positions.push(...c.p); landmark.normals.push(...c.n); landmark.colours.push(...nearColourOf(c.uv)); landmark.uvs.push(...c.uv); }
  const farLandmark = { positions: [], colours: [] };
  for (const c of farPlaced) { farLandmark.positions.push(...c.p); farLandmark.colours.push(...colourOf(c.uv)); }
  for (let i = 0; i < farPlaced.length; i += 3) {
    const [a, b, c] = farPlaced.slice(i, i + 3);
    if (a !== undefined && b !== undefined && c !== undefined) parts.solid.tri('Solid', a.p, b.p, c.p);
  }
  // the floor everyone walks on (the canals' water sits below it, behind their rims)
  parts.solid.quad('Solid', [-250, 0, -250], [-250, 0, 250], [250, 0, 250], [250, 0, -250]);
  // RM3 prepares the actual post-lantern bake at neutral strength, preserving today's look.
  // RM6 owns visible light tuning; radius/cut give the existing 4.5 m post-pool reach.
  const surface = parts.Kit.part('Kit');
  surface.colours = bakeLanternVertices(surface, lanterns, { gain: 0, radius: 1.5, cut: 3 });
  console.info(`open-plots: ${layoutName} lantern bake: ${lanterns.length} emitters, neutral gain 0 (RM6 tuning pending)`);
  return { parts, landmark, farLandmark, nearImage, poster: resolve(repo, layout.posters.image) };
}

/** Write a tiled idea's `assets/<idea>/world.glb`. */
export async function writeTiledWorld(root, repo, idea) {
  const { parts, landmark, farLandmark, nearImage, poster: posterFile } = await tiledPlot(root, repo, idea.layout);
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('plot');
  const texture = async (name, pixels) => doc.createTexture(name).setImage(await writeImagePixels(pixels)).setMimeType('image/png');
  const materials = {
    Paving: doc.createMaterial('Paving').setBaseColorFactor([...linear(JSON.parse(readFileSync(resolve(root, 'data/layouts', `${idea.layout}.json`), 'utf8')).palette.ring), 1]).setRoughnessFactor(1).setMetallicFactor(0),
    Kit: doc.createMaterial('Kit').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0),
    Glow: doc.createMaterial('Glow').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0),
    Pool: doc.createMaterial('Pool').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0),
    Water: doc.createMaterial('Water').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.12).setMetallicFactor(0.2),
    Landmark: doc.createMaterial('Landmark').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.8).setMetallicFactor(0).setBaseColorTexture(await texture('landmark', nearImage)),
    Poster: doc.createMaterial('Poster').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setBaseColorTexture(await texture('poster', await readImagePixels(readFileSync(posterFile)))),
  };
  for (const material of [materials.Landmark, materials.Poster]) material.getBaseColorTextureInfo()?.setWrapS(33071).setWrapT(33071).setMinFilter(9987).setMagFilter(9729);
  const accessor = (values, type) => doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
  // each part welded (corners sharing position, normal, colour and uv become one indexed vertex)
  const node = (name, part, material, { uv = false, normals = true } = {}) => {
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
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  };
  node('ws_terrain_floor', parts.Paving.part('Paving'), materials.Paving);
  node('draw_kit', parts.Kit.part('Kit'), materials.Kit);
  node('draw_water', parts.Water.part('Water'), materials.Water);
  node('draw_glow', parts.Glow.part('Glow'), materials.Glow);
  node('draw_pool', parts.Pool.part('Pool'), materials.Pool, { normals: false });
  node('draw_poster', parts.Poster.part('Poster'), materials.Poster, { uv: true });
  node('draw_landmark', landmark, materials.Landmark, { uv: true });
  // the far proxy's own nodes (far only): the tiles' stand-ins and boards, the landmark's far model
  node('far_tiles', parts.far.part('far'), materials.Kit, { normals: false });
  node('far_landmark', { ...farLandmark, normals: [], uvs: [] }, materials.Kit, { normals: false });
  node('collide_plot', { ...parts.solid.part('Solid'), colours: parts.solid.part('Solid').positions.map(() => 1) }, materials.Kit, { normals: false });
  const bytes = await new NodeIO().writeBinary(doc), out = resolve(root, 'assets', idea.idea);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'world.glb'), bytes);
  const count = (soup, name) => soup.part(name).positions.length / 9;
  console.info(`open-plots: ${idea.slug} world.glb ${bytes.length} bytes, tiled ${idea.layout}: kit ${count(parts.Kit, 'Kit')} glow ${count(parts.Glow, 'Glow')} pool ${count(parts.Pool, 'Pool')} landmark ${landmark.positions.length / 9} far ${count(parts.far, 'far') + farLandmark.positions.length / 9} triangles`);
}
