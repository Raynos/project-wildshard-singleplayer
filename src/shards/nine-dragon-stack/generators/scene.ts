import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { BufferAttribute, BufferGeometry, DataUtils, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { drawSpill, withSpill, type NineSpillAtlas } from './spillBake';
import { bakeOwned, BakedPiece, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import { partitionWholeGeometry, wholePartitionRuns, type PropWhole } from '@wildshard/sdk/bake/props';
import { coarseGeometry } from '@wildshard/sdk/bake/coarseCopy';
import { nineLayoutSource } from './layout';
import { bootSpecimen, specimenRecipes } from './specimens';
import { mistSheetsGeometry, steamPuffsGeometry } from './mistGeometry';
import worldDressingRows from '../data/worldDressing.json' with { type: 'json' };
import { WELL_RECTS } from './wellBounds';
import { banyanOut } from './banyanPlan';

const { SHEET_LAYERS, STEAM_PUFFS } = worldDressingRows;


/** Channels of Nine's unchanged material fallback, retained as ordinary GLB application attributes. */
export function nineChannels(geometry: BufferGeometry): Record<string, string> {
  return Object.fromEntries(Object.keys(geometry.attributes).filter(name => !['position', 'normal', 'color', 'uv', 'tangent'].includes(name))
    .map(name => [`_${name.toUpperCase()}`, name]));
}

// The L1 tile caps (CONTENT_CAPS.l1: 2 draws, 10k triangles, 0.2 MB), with headroom: a parent's raw channel bytes stand in
// for its stored GLB (the store never grows them)
const COARSE_DRAWS = 2, COARSE_TRIANGLES = 9_000, COARSE_BYTES = 180_000;
const geometryBytes = (geometry: BufferGeometry): number =>
  Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, geometry.getIndex()?.array.byteLength ?? 0);
const triangleCount = (geometry: BufferGeometry): number => (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3;

/** The fabric's raw half-float face and pattern channels as Float32 (their values unchanged), so the half and float
 *  fabric pieces share one channel set; other storage is kept as is. */
function widenHalves(piece: BufferGeometry): void {
  if (!piece.hasAttribute('aOff')) return;
  for (const name of ['aFace', 'aPat']) {
    const attribute = piece.getAttribute(name);
    if (!(attribute instanceof BufferAttribute) || !(attribute.array instanceof Uint16Array) || attribute.normalized) continue;
    piece.setAttribute(name, new BufferAttribute(Float32Array.from(attribute.array, value => DataUtils.fromHalfFloat(value)), attribute.itemSize));
  }
}

/** A parent's pieces merged by channel set (names, widths and storage alike), one geometry per set. */
function coarseSets(pieces: readonly BufferGeometry[]): BufferGeometry[] {
  const bySet = new Map<string, BufferGeometry[]>();
  for (const piece of pieces) {
    widenHalves(piece);
    const signature = Object.entries(piece.attributes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.array.constructor.name}:${String(attribute.normalized)}`).join('|');
    const list = bySet.get(signature) ?? []; list.push(piece); bySet.set(signature, list);
  }
  return [...bySet.values()].map(list => {
    const merged = new BufferGeometry(), first = list[0];
    if (first === undefined) throw new Error('Nine coarse set is empty');
    const counts = list.map(piece => piece.getAttribute('position').count);
    for (const [name, attribute] of Object.entries(first.attributes)) {
      if (!(attribute instanceof BufferAttribute)) throw new Error(`Nine coarse channel ${name} is not plain`);
      const values = attribute.array.slice(0, 0), all = new (values.constructor as new (length: number) => typeof values)(counts.reduce((sum, n) => sum + n, 0) * attribute.itemSize);
      let at = 0;
      for (const piece of list) { const source = piece.getAttribute(name).array; all.set(source, at); at += source.length; }
      merged.setAttribute(name, new BufferAttribute(all, attribute.itemSize, attribute.normalized));
    }
    const indices: number[] = []; let base = 0;
    for (const [p, piece] of list.entries()) { for (const corner of piece.getIndex()?.array ?? []) indices.push(corner + base); base += counts[p] ?? 0; piece.dispose(); }
    merged.setIndex(indices);
    return merged;
  });
}

/** A copy keeping only the vertices its triangles use (the simplifier leaves the rest in place), every channel in its
 *  own storage. */
function usedVertices(geometry: BufferGeometry): BufferGeometry {
  const index = geometry.getIndex();
  if (index === null) throw new Error('Nine coarse parent needs an index');
  const remap = new Map<number, number>(), order: number[] = [];
  const corners = Array.from(index.array, vertex => { let at = remap.get(vertex); if (at === undefined) { at = order.length; remap.set(vertex, at); order.push(vertex); } return at; });
  const used = new BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!(attribute instanceof BufferAttribute)) throw new Error(`Nine coarse channel ${name} is not plain`);
    const width = attribute.itemSize, values = attribute.array.slice(0, order.length * width);
    order.forEach((vertex, i) => { for (let k = 0; k < width; k++) values[i * width + k] = attribute.array[vertex * width + k] ?? 0; });
    used.setAttribute(name, new BufferAttribute(values, width, attribute.normalized));
  }
  used.setIndex(corners);
  return used;
}

/** Simplify a parent's sets until together they fit the caps: each pass shrinks the largest set that still shrinks by the
 *  share it must lose. Replaced geometries are disposed. */
function fitCoarse(input: readonly BufferGeometry[], parent: string): BufferGeometry[] {
  const sets = [...input], stuck = new Set<number>();
  const sum = (cost: (geometry: BufferGeometry) => number): number => sets.reduce((total, geometry) => total + cost(geometry), 0);
  for (let pass = 0; pass < 32 && (sum(triangleCount) > COARSE_TRIANGLES || sum(geometryBytes) > COARSE_BYTES); pass++) {
    let at = -1;
    for (const [i, geometry] of sets.entries()) if (!stuck.has(i) && (at < 0 || geometryBytes(geometry) > geometryBytes(sets[at] ?? geometry))) at = i;
    const largest = sets[at];
    if (largest === undefined) break;
    const keep = Math.min((COARSE_TRIANGLES - (sum(triangleCount) - triangleCount(largest))) / triangleCount(largest),
      (COARSE_BYTES - (sum(geometryBytes) - geometryBytes(largest))) / geometryBytes(largest));
    const simplified = coarseGeometry(largest, Math.min(0.9, Math.max(0.05, 0.9 * keep)), 6, { sloppy: true }), next = usedVertices(simplified);
    simplified.dispose();
    if (triangleCount(next) >= triangleCount(largest)) { next.dispose(); stuck.add(at); continue; }
    largest.dispose(); sets[at] = next;
  }
  if (sum(triangleCount) > COARSE_TRIANGLES || sum(geometryBytes) > COARSE_BYTES) {
    throw new Error(`Nine coarse parent ${parent} does not fit its L1 caps: ${sum(triangleCount)} triangles, ${sum(geometryBytes)} B`);
  }
  return sets;
}

/** Static fabric is drawn from whole L0 nodes; local specimens are standard instanced-kind library GLBs. */
function buildNineScene(atlas: NineSpillAtlas): { baked: BakedScene; layout: ReturnType<typeof nineLayoutSource>; keys: { boot: string[]; explorer: string[] }; boxes: Record<string, boolean> } {
  const layout = nineLayoutSource(), scene = new Scene(); scene.name = 'nine-dragon-stack';
  const material = new MeshStandardMaterial({ vertexColors: true });
  // each kit's neon spill rides in its tiles as the aSpill channel (generators/spillBake.ts `drawSpill`)
  const spill = drawSpill(atlas);
  for (const { name, geo } of layout.rows.kits) {
    const geometry = geo === null ? null : layout.geometries[geo];
    if (geometry === undefined) throw new Error(`Nine scene: missing kit geometry ${name}`);
    if (geometry !== null) withSpill(geometry, spill, name);
  }
  const local = new Set(layout.rows.sets.map(set => set.geo));
  // The skyline crown reaches +273.5 m: retain that out-of-cube backdrop as an unchanged library geometry.
  const crown = layout.rows.kits.find(kit => kit.name === 'crown')?.geo;
  if (crown !== undefined && crown !== null) local.add(crown);
  // G748 / tile streaming T8: the city's coarse L1 copy keeps every Nine channel (its night look). Each L1 parent's pieces
  // merge into one draw per channel set, simplified until the parent fits the L1 tile caps (CONTENT_CAPS.l1)
  const coarseWhite = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 }), coarseWhole: PropWhole[] = [];
  const parents = new Map<number, BufferGeometry[]>();
  for (const [i, geometry] of layout.geometries.entries()) {
    if (local.has(i)) continue;
    const mesh = new Mesh(geometry, material); mesh.name = `layout_${i}`;
    scene.add(new WholeShape(mesh.name, mesh, { customAttributes: nineChannels(geometry), nativeAttributes: true, partition: 'runs' }));
    const coarse = coarseGeometry(geometry, 0.05, 3, { sloppy: true });
    for (const piece of coarseParents(coarse)) { const key = piece.z * 4 + piece.x, list = parents.get(key) ?? []; list.push(piece.geometry); parents.set(key, list); }
    coarse.dispose();
  }
  for (const [key, pieces] of parents) {
    const x = key % 4, z = Math.floor(key / 4), transform = new Matrix4().makeTranslation(-250 + (x + 0.5) * 125, 0, -250 + (z + 0.5) * 125);
    const sets = coarseSets(pieces);
    if (sets.length > COARSE_DRAWS) throw new Error(`Nine coarse parent ${x}/${z} needs ${sets.length} channel sets`);
    for (const [s, fitted] of fitCoarse(sets, `${x}/${z}`).entries()) {
      coarseWhole.push({ id: `coarse_${x}_${z}_${s}`, mesh: new Mesh(fitted, coarseWhite), transform, customAttributes: nineChannels(fitted), nativeAttributes: true });
    }
  }
  const keys: { boot: string[]; explorer: string[] } = { boot: [], explorer: [] };
  let library = 0; const boxes: Record<string, boolean> = {};
  const part = (name: string, entries: readonly (readonly [string, BufferGeometry])[]): void => {
    for (const [key, geometry] of entries) for (const subset of partitionWholeGeometry(geometry)) {
      const mesh = new InstancedMesh(subset.geometry, material, 1), id = `${name}_${library++}`;
      const metadata = { id: key, vertices: wholePartitionRuns(subset.vertices), triangles: wholePartitionRuns(subset.triangles),
        vertexCount: geometry.getAttribute('position').count, indexCount: geometry.getIndex()?.count ?? 0,
        index: geometry.getIndex() === null ? 'none' : geometry.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32' };
      scene.add(new BakedPiece(id, [[id, mesh]], [], { attributes: nineChannels(subset.geometry), nativeAttributes: true, compactIndex: true,
        nodeExtras: () => ({ wholePartition: metadata }) }));
    }
  };
  part('layout_sets', [...local].map(index => {
    const geometry = layout.geometries[index];
    if (geometry === undefined) throw new Error(`Nine scene: missing local geometry ${index}`);
    return [`layout_${index}`, geometry] as const;
  }));
  const recipes = specimenRecipes(banyanOut.plan?.lumps ?? []).map(([key, build]): [string, () => BufferGeometry] =>
    [key, key === 'canopy:cards' || key === 'canopy:core' ? () => withSpill(build(), spill, key.replace(':', '-')) : build]);
  const counts = layout.rows.counts, start = (counts.walkers + counts.sitters + counts.lanterns + counts.acs) * 16 + counts.hooks * 3 + counts.hookMounts * 6;
  const steam = Array.from({ length: counts.steam }, (_, i) => new Vector3().fromArray(layout.records, start + i * 3));
  if (layout.rows.sheets.length > 0) recipes.push(['mist:sheets', () => mistSheetsGeometry(layout.rows.sheets, WELL_RECTS, SHEET_LAYERS)]);
  recipes.push(['mist:steam', () => steamPuffsGeometry(steam, STEAM_PUFFS.perPoint, STEAM_PUFFS.stride)]);
  for (const name of ['boot', 'explorer'] as const) {
    const entries = recipes.filter(([key]) => bootSpecimen(key) === (name === 'boot')).map(([key, build]) => [key, build()] as const);
    keys[name] = entries.map(([key]) => key);
    for (const [key, geometry] of entries) boxes[key] = geometry.boundingBox !== null;
    part(`specimens_${name}`, entries);
  }
  const baked = bakeOwned(scene, { slug: 'nine-dragon-stack', name: 'Nine Dragon Stack' }, { props: { coarseWhole } });
  for (const entry of coarseWhole) entry.mesh.geometry.dispose();
  coarseWhite.dispose();
  return { baked, layout, keys, boxes };
}

/** Portable author math keeps the exact scene reproducible across arm64 Mac and Linux x64. */
export function nineScene(atlas: NineSpillAtlas): ReturnType<typeof buildNineScene> { return withPortableMath(() => buildNineScene(atlas)); }

/** A cell-space geometry's triangles split by centroid into its 125 m L1 parents, each piece's positions relative to its
 *  parent's centre (its transform), so the props bake files it in that parent's L1 tile; every channel is kept. */
function coarseParents(geometry: BufferGeometry): { x: number; z: number; geometry: BufferGeometry; transform: Matrix4 }[] {
  const position = geometry.getAttribute('position'), index = geometry.getIndex();
  if (!(position instanceof BufferAttribute)) throw new Error('Nine coarse copy needs plain positions');
  const corners = index === null ? Array.from({ length: position.count }, (_, i) => i) : Array.from(index.array), buckets = new Map<number, number[]>();
  for (let t = 0; t + 2 < corners.length; t += 3) {
    const a = corners[t] ?? 0, b = corners[t + 1] ?? 0, c = corners[t + 2] ?? 0;
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3, z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const px = Math.min(3, Math.max(0, Math.floor((x + 250) / 125))), pz = Math.min(3, Math.max(0, Math.floor((z + 250) / 125))), key = pz * 4 + px;
    const list = buckets.get(key) ?? []; list.push(a, b, c); buckets.set(key, list);
  }
  return [...buckets].map(([key, list]) => {
    const x = key % 4, z = Math.floor(key / 4), cx = -250 + (x + 0.5) * 125, cz = -250 + (z + 0.5) * 125, remap = new Map<number, number>(), order: number[] = [];
    const indices = list.map(vertex => { let at = remap.get(vertex); if (at === undefined) { at = order.length; remap.set(vertex, at); order.push(vertex); } return at; });
    const piece = new BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!(attribute instanceof BufferAttribute)) throw new Error(`Nine coarse channel ${name} is not plain`);
      // the channel's own storage (Nine keeps raw Float16 channels): a same-type copy, refilled in the piece's vertex order
      const width = attribute.itemSize, values = attribute.array.slice(0, order.length * width);
      order.forEach((vertex, i) => { for (let k = 0; k < width; k++) values[i * width + k] = attribute.array[vertex * width + k] ?? 0; });
      if (name === 'position') for (let i = 0; i < order.length; i++) { values[i * 3] = (values[i * 3] ?? 0) - cx; values[i * 3 + 2] = (values[i * 3 + 2] ?? 0) - cz; }
      piece.setAttribute(name, new BufferAttribute(values, width, attribute.normalized));
    }
    piece.setIndex(indices);
    return { x, z, geometry: piece, transform: new Matrix4().makeTranslation(cx, 0, cz) };
  });
}
