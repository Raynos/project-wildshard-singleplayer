import { Box3, BufferAttribute, BufferGeometry, Float16BufferAttribute, Float32BufferAttribute, Matrix3, Matrix4, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3, type Object3D } from 'three';
import { CONTENT_CAPS, CELL_ABOVE, CELL_BELOW } from '@wildshard/format/contentBounds';
import { PropsSchema, type ShardProps } from '@wildshard/format/props';
import type { Shardfile } from '@wildshard/format/shardSchema';
import * as v from 'valibot';
import { parseGlb, parseKtx2 } from '../assets';
import { hashImmutableBytes as contentHash } from '../immutable';
import { staticGlb, type GlbPrimitive } from './glb';

/** A reusable scatter shape and its world-local positive TRS matrices; generators run only at build time. */
export interface PropScatter { model: Object3D; transforms: readonly Matrix4[] }
/** Trusted static content. Named panels remain separate, and coarse/far replacements are optional build-time inputs. */
export interface PropsBakeSource {
  static: Object3D; scatter?: readonly PropScatter[];
  panels?: readonly { id: string; model: Object3D; visible?: boolean }[]; colliders?: ShardProps['colliders']; models?: readonly { id: string; model: Object3D }[];
  coarse?: Object3D; far?: Object3D; family?: string; colourTexture?: Uint8Array;
  /** Shapes baked whole (`PropWhole`), each one named node in the L0 tile that holds its origin. */
  whole?: readonly PropWhole[];
}
/**
 * A mesh kept whole in its own frame, never cut at a tile seam: one GLB node named `id` (a loader-safe identifier) at
 * `transform` (positive TRS) with the mesh's own attributes and index (or none), owned by the L0 tile holding its origin (in no coarse tile
 * and no far proxy: a whole shape is never decimated), so a runtime drawing it in its own material finds it by name and draws exactly the triangles it built. Its surface is opaque,
 * untextured, nonmetal and white (the colour is the vertices'); the GLB keeps its roughness and its `castShadow`.
 */
export interface PropWhole {
  id: string; mesh: Mesh; transform: Matrix4;
  /** Application semantic → source channel, retained whole beside positions, normals and colours. */
  customAttributes?: GlbPrimitive['customAttributes'];
  /** Preserve typed channels and source transform doubles in GLB node extras (see staticGlb). */
  nativeAttributes?: true;
  /** Assign each unchanged triangle to its world-space centroid's tile; extras retain exact assembly ordinals. */
  partition?: true;
}

/** One exact subset of a whole geometry. Ordinals address the original vertices and triangles, not clipped fragments. */
export interface WholeGeometryPart { x: number; z: number; geometry: BufferGeometry; vertices: number[]; triangles: number[] }
interface PreparedWhole {
  id: string; at: Vector3; castShadow: boolean; geometry: BufferGeometry; material: MeshStandardMaterial; transform: Matrix4;
  customAttributes: GlbPrimitive['customAttributes']; nativeAttributes: GlbPrimitive['nativeAttributes'];
  owner: { x: number; z: number } | null; extras: GlbPrimitive['extras'];
}

function subsetAttribute(attribute: BufferAttribute, selected: readonly number[]): BufferAttribute {
  const array = attribute.array.slice(0, selected.length * attribute.itemSize);
  // slice above may be smaller than the requested size only if callers repeat vertices (partitioning deduplicates).
  if (array.length !== selected.length * attribute.itemSize) throw new Error('Whole geometry subset exceeds source vertices');
  for (const [i, vertex] of selected.entries()) array.set(attribute.array.subarray(vertex * attribute.itemSize, (vertex + 1) * attribute.itemSize), i * attribute.itemSize);
  return attribute instanceof Float16BufferAttribute ? new Float16BufferAttribute(array, attribute.itemSize, attribute.normalized)
    : new BufferAttribute(array, attribute.itemSize, attribute.normalized);
}

/** Partition triangles without clipping or rounding any source channel; world transforms affect ownership only. */
export function partitionWholeGeometry(sourceGeometry: BufferGeometry, transform = new Matrix4()): WholeGeometryPart[] {
  const position = sourceGeometry.getAttribute('position'), index = sourceGeometry.getIndex(), count = index?.count ?? position.count;
  if (count % 3 !== 0) throw new Error('Whole geometry requires triangles');
  const groups = new Map<string, { x: number; z: number; vertices: number[]; triangles: number[]; indices: number[]; lookup: Map<number, number> }>();
  const point = new Vector3(), centroid = new Vector3();
  for (let triangle = 0; triangle < count / 3; triangle++) {
    const ids = [0, 1, 2].map(corner => index?.getX(triangle * 3 + corner) ?? triangle * 3 + corner);
    centroid.set(0, 0, 0);
    for (const vertex of ids) centroid.add(point.fromBufferAttribute(position, vertex).applyMatrix4(transform));
    centroid.multiplyScalar(1 / 3);
    const x = Math.min(7, Math.floor((centroid.x + 250) / 62.5)), z = Math.min(7, Math.floor((centroid.z + 250) / 62.5));
    if (!Number.isFinite(centroid.x) || !Number.isFinite(centroid.z) || x < 0 || z < 0 || centroid.x > 250 || centroid.z > 250) throw new Error('Whole triangle centroid outside the cell');
    const key = `${x}/${z}`, group = groups.get(key) ?? { x, z, vertices: [], triangles: [], indices: [], lookup: new Map<number, number>() };
    group.triangles.push(triangle);
    for (const vertex of ids) {
      let local = group.lookup.get(vertex);
      if (local === undefined) { local = group.vertices.length; group.lookup.set(vertex, local); group.vertices.push(vertex); }
      group.indices.push(local);
    }
    groups.set(key, group);
  }
  // Unreferenced authored vertices still belong to the exact source layout; carry them in the first occupied tile.
  const first = groups.values().next().value;
  if (first !== undefined) {
    const referenced = new Set([...groups.values()].flatMap(group => group.vertices));
    for (let vertex = 0; vertex < position.count; vertex++) if (!referenced.has(vertex)) first.vertices.push(vertex);
  }
  return [...groups.values()].sort((a, b) => a.x - b.x || a.z - b.z).map(group => {
    const part = new BufferGeometry();
    for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
      if (!(attribute instanceof BufferAttribute)) throw new Error('Whole geometry requires non-interleaved channels');
      part.setAttribute(name, subsetAttribute(attribute, group.vertices));
    }
    if (index !== null) part.setIndex(new BufferAttribute(index.array instanceof Uint16Array ? new Uint16Array(group.indices) : new Uint32Array(group.indices), 1));
    return { x: group.x, z: group.z, geometry: part, vertices: group.vertices, triangles: group.triangles };
  });
}

/** Reconstruct the original mesh from any ordering of exact subsets. `shape` supplies storage/layout, never vertex values. */
export function assembleWholeGeometry(shape: BufferGeometry, parts: readonly WholeGeometryPart[]): BufferGeometry {
  const result = new BufferGeometry(), count = shape.getAttribute('position').count, seen = new Uint8Array(count);
  const originalIndex = shape.getIndex(), triangleCount = (originalIndex?.count ?? count) / 3, triangles = new Uint8Array(triangleCount);
  for (const [name, attribute] of Object.entries(shape.attributes)) {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Whole geometry requires non-interleaved channels');
    const copy = attribute.clone(); copy.array.fill(0); result.setAttribute(name, copy);
  }
  if (originalIndex !== null) { const copy = originalIndex.clone(); copy.array.fill(0); result.setIndex(copy); }
  for (const part of parts) {
    for (const [local, vertex] of part.vertices.entries()) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= count) throw new Error('Whole assembly vertex ordinal outside source');
      for (const [name, destination] of Object.entries(result.attributes)) {
        const source = part.geometry.getAttribute(name);
        if (!(source instanceof BufferAttribute) || !(destination instanceof BufferAttribute) || source.itemSize !== destination.itemSize || source.normalized !== destination.normalized || source.array.constructor !== destination.array.constructor) throw new Error('Whole assembly channel layout mismatch');
        const values = source.array.subarray(local * source.itemSize, (local + 1) * source.itemSize);
        if (seen[vertex] === 1) for (const [i, value] of values.entries()) if (!Object.is(value, destination.array[vertex * destination.itemSize + i])) throw new Error('Whole assembly shared vertex differs');
        destination.array.set(values, vertex * destination.itemSize);
      }
      seen[vertex] = 1;
    }
    const index = part.geometry.getIndex();
    for (const [local, triangle] of part.triangles.entries()) {
      if (!Number.isInteger(triangle) || triangle < 0 || triangle >= triangleCount || triangles[triangle] === 1) throw new Error('Whole assembly duplicate or invalid triangle');
      for (let corner = 0; corner < 3; corner++) {
        const vertex = part.vertices[index?.getX(local * 3 + corner) ?? local * 3 + corner];
        if (vertex === undefined) throw new Error('Whole assembly missing triangle vertex');
        if (result.index !== null) result.index.setX(triangle * 3 + corner, vertex);
        else if (vertex !== triangle * 3 + corner) throw new Error('Whole assembly non-indexed triangle mismatch');
      }
      triangles[triangle] = 1;
    }
  }
  if (seen.some(value => value === 0) || triangles.some(value => value === 0)) throw new Error('Whole assembly incomplete');
  result.groups = shape.groups.map(group => ({ ...group })); result.drawRange = { ...shape.drawRange };
  result.boundingBox = shape.boundingBox?.clone() ?? null; result.boundingSphere = shape.boundingSphere?.clone() ?? null;
  return result;
}
/** Content-addressed GLBs and tile rows, including actual budget numbers and an independent far proxy (none for whole shapes alone). */
export interface BakedProps {
  props: ShardProps; tiles: Shardfile['tiles']; files: Shardfile['files']; library: string[];
  far: NonNullable<Shardfile['far']> | null; assets: Map<string, Uint8Array>;
  report: readonly { lod: number; x: number; z: number; resident: number; compressed: number; triangles: number; draws: number; warnings?: readonly string[] }[];
}
interface Vertex { p: Vector3; n: Vector3; c: Vector3; u: number; v: number }
function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
function vertices(root: Object3D, transform = new Matrix4(), rough = true): Vertex[][] {
  root.updateMatrixWorld(true); const result: Vertex[][] = [];
  root.traverse((object) => {
    if (!isMesh(object)) return;
    if (object instanceof SkinnedMesh || Array.isArray(object.material) || !(object.material instanceof MeshStandardMaterial) || object.material.transparent || object.material.metalness !== 0 || (rough && object.material.roughness !== 1) || object.material.map !== null) throw new Error('Static merge needs opaque untextured nonmetal rough surfaces; bake textured shapes as scatter');
    const g = object.geometry; if (!g.hasAttribute('position') || !g.hasAttribute('normal')) throw new Error('Static prop needs positions and normals');
    const p = g.getAttribute('position'), normal = g.getAttribute('normal'), uv = g.hasAttribute('uv') ? g.getAttribute('uv') : undefined, colour = g.hasAttribute('color') ? g.getAttribute('color') : undefined, index = g.getIndex();
    const matrix = transform.clone().multiply(object.matrixWorld), n = index?.count ?? p.count;
    if (n % 3 !== 0) throw new Error('Static prop needs triangles');
    for (let i = 0; i < n; i += 3) {
      const triangle: Vertex[] = [];
      for (let j = 0; j < 3; j++) {
        const at = index?.getX(i + j) ?? i + j, point = new Vector3().fromBufferAttribute(p, at).applyMatrix4(matrix);
        if (![point.x, point.y, point.z].every(Number.isFinite) || Math.abs(point.x) > 250 || Math.abs(point.z) > 250 || point.y < -CELL_BELOW || point.y > CELL_ABOVE) throw new Error('Prop outside the cell');
        const c = colour === undefined ? new Vector3(1, 1, 1) : new Vector3().fromBufferAttribute(colour, at);
        c.multiply(new Vector3(...object.material.color));
        triangle.push({ p: point, n: new Vector3().fromBufferAttribute(normal, at).applyNormalMatrix(new Matrix3().getNormalMatrix(matrix)), c, u: uv?.getX(at) ?? 0, v: uv?.getY(at) ?? 0 });
      }
      result.push(triangle);
    }
  }); return result;
}
function geometry(triangles: readonly Vertex[][], bounds?: readonly [number, number, number, number]): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], uvs: number[] = [];
  for (const triangle of triangles) {
    let polygon = [...triangle];
    if (bounds !== undefined) for (const [axis, limit, direction] of [['x', bounds[0], 1], ['x', bounds[1], -1], ['z', bounds[2], 1], ['z', bounds[3], -1]] as const) {
      const input = polygon; polygon = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i], b = input[(i + 1) % input.length]; if (a === undefined || b === undefined) continue;
        const da = (a.p[axis] - limit) * direction, db = (b.p[axis] - limit) * direction;
        if (da >= 0) polygon.push(a);
        if ((da < 0) !== (db < 0)) { const t = da / (da - db); polygon.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), c: a.c.clone().lerp(b.c, t), u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t }); }
      }
    }
    for (let i = 1; i + 1 < polygon.length; i++) {
      const a = polygon[0], b = polygon[i], c = polygon[i + 1]; if (a === undefined || b === undefined || c === undefined || new Vector3().subVectors(b.p, a.p).cross(new Vector3().subVectors(c.p, a.p)).lengthSq() < 1e-16) continue;
      for (const vertex of [a, b, c]) { positions.push(...vertex.p); normals.push(...vertex.n); colours.push(...vertex.c); uvs.push(vertex.u, vertex.v); }
    }
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)).setAttribute('normal', new Float32BufferAttribute(normals, 3)).setAttribute('color', new Float32BufferAttribute(colours, 3)).setAttribute('uv', new Float32BufferAttribute(uvs, 2));
}
const mergedMaterial = () => new MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
/** Merge props into the canonical 8×8 / 4×4 grid, instance L0 scatter, and refuse every over-budget output. */
export function bakeProps(source: PropsBakeSource, terrain: readonly Shardfile['tiles'][number][] = []): BakedProps {
  const tileWarnings = new Map<string, readonly string[]>();
  const files: Shardfile['files'] = [], assets = new Map<string, Uint8Array>(), library: string[] = [], tiles = terrain.map((t) => ({ ...t, files: [...t.files], bounds: { min: [...t.bounds.min] as [number, number, number], max: [...t.bounds.max] as [number, number, number] } }));
  const section: ShardProps = { version: 1, family: source.family ?? 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: source.colliders ?? [] };
  const store = (bytes: Uint8Array, kind: 'glb' | 'ktx2'): Shardfile['files'][number] => {
    const hash = contentHash(bytes), cost = kind === 'glb' ? parseGlb(bytes) : parseKtx2(bytes);
    const row = { hash, kind, compressed: bytes.length, ...cost, dependencies: [] as string[], critical: false };
    if (!assets.has(hash)) { assets.set(hash, bytes); files.push(row); } return row;
  };
  const texture = source.colourTexture === undefined ? null : store(source.colourTexture, 'ktx2');
  const save = (primitives: readonly GlbPrimitive[], name: string) => {
    const row = store(staticGlb(primitives, name), 'glb');
    if (texture !== null) { row.dependencies = [texture.hash]; const prior = files.find((f) => f.hash === row.hash); if (prior !== undefined) prior.dependencies = row.dependencies; section.textures.push({ model: row.hash, colour: texture.hash }); }
    return row;
  };
  const whole = (source.whole ?? []).flatMap((entry): PreparedWhole[] => {
    const { mesh } = entry, at = new Vector3().setFromMatrixPosition(entry.transform), m = mesh.material;
    if (!(at.x >= -250 && at.x < 250 && at.z >= -250 && at.z < 250)) throw new Error(`Whole prop ${entry.id} origin outside the cell`);
    if (!(m instanceof MeshStandardMaterial) || m.transparent || m.metalness !== 0 || m.map !== null || m.color.getHex() !== 0xffffff) throw new Error(`Whole prop ${entry.id} needs one opaque untextured nonmetal white surface`);
    const placed = new Mesh(mesh.geometry, m); placed.applyMatrix4(entry.transform); vertices(placed, new Matrix4(), false); // refuses a shape outside the cell
    // the shape's own attributes and index, untouched: the runtime draws exactly the triangles it built
    const g = new BufferGeometry(); for (const key of ['position', 'normal', 'color', ...Object.values(entry.customAttributes ?? {})]) if (mesh.geometry.hasAttribute(key)) g.setAttribute(key, mesh.geometry.getAttribute(key));
    g.setIndex(mesh.geometry.getIndex());
    const base = { id: entry.id, at, castShadow: mesh.castShadow, geometry: g, material: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: m.roughness }), transform: entry.transform, customAttributes: entry.customAttributes, nativeAttributes: entry.nativeAttributes };
    if (entry.partition !== true) return [{ ...base, owner: null, extras: undefined }];
    const preparedParts: PreparedWhole[] = [];
    for (const part of partitionWholeGeometry(g, entry.transform)) {
      const prepared: PreparedWhole = { ...base, id: `${entry.id}_p${part.x}_${part.z}`, geometry: part.geometry,
      owner: { x: part.x, z: part.z }, extras: { wholePartition: { id: entry.id, vertices: part.vertices, triangles: part.triangles,
        vertexCount: g.getAttribute('position').count, indexCount: g.getIndex()?.count ?? 0,
        index: g.getIndex() === null ? 'none' : g.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32' } } };
      preparedParts.push(prepared);
    }
    return preparedParts;
  });
  const base = vertices(source.static), spill: Vertex[][] = [], eligible = new Map<PropScatter, Matrix4[]>();
  for (const batch of source.scatter ?? []) {
    const keep: Matrix4[] = [];
    for (const matrix of batch.transforms) {
      const triangles = vertices(batch.model, matrix), box = new Box3().setFromPoints(triangles.flat().map((vertex) => vertex.p)), p = new Vector3().setFromMatrixPosition(matrix), x = -250 + Math.floor((p.x + 250) / 62.5) * 62.5, z = -250 + Math.floor((p.z + 250) / 62.5) * 62.5;
      if (box.min.x < x || box.max.x > x + 62.5 || box.min.z < z || box.max.z > z + 62.5) spill.push(...triangles); else keep.push(matrix);
    }
    eligible.set(batch, keep);
  }
  // Hidden panels remain controllable library objects; an unconditional proxy must never make them visible.
  const scattered = (source.scatter ?? []).flatMap((s) => s.transforms.flatMap((m) => vertices(s.model, m))), panelTriangles = (source.panels ?? []).filter((p) => p.visible !== false).flatMap((p) => vertices(p.model)), coarse = source.coarse === undefined ? [...base, ...scattered, ...panelTriangles] : vertices(source.coarse);
  const panelFiles = (source.panels ?? []).map((entry) => { const g = geometry(vertices(entry.model)), file = save([{ geometry: g, material: mergedMaterial() }], entry.id); g.computeBoundingBox(); library.push(file.hash); section.panels.push({ id: entry.id, file: file.hash, visible: entry.visible ?? true }); return { file, bounds: g.boundingBox }; });
  for (const lod of [0, 1] as const) {
    const size = lod === 0 ? 62.5 : 125, count = 500 / size;
    for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
      const x0 = -250 + x * size, z0 = -250 + z * size, bounds: [number, number, number, number] = [x0, x0 + size, z0, z0 + size], primitives: GlbPrimitive[] = [], g = geometry(lod === 0 ? [...base, ...spill] : coarse, bounds);
      if (g.getAttribute('position').count > 0) primitives.push({ geometry: g, material: mergedMaterial(), castShadow: lod === 0 });
      if (lod === 0) for (const batch of source.scatter ?? []) {
        const transforms = (eligible.get(batch) ?? []).filter((m) => { const p = new Vector3().setFromMatrixPosition(m); return p.x >= x0 && p.x < x0 + size && p.z >= z0 && p.z < z0 + size; });
        if (transforms.length === 0) continue;
        // Scatter keeps a model in one owning tile; its conservative bounds may extend into its neighbours.
        const local = geometry(vertices(batch.model)); primitives.push({ geometry: local, material: mergedMaterial(), instances: transforms });
      }
      for (const w of lod === 0 ? whole : []) if (w.owner === null ? w.at.x >= x0 && w.at.x < x0 + size && w.at.z >= z0 && w.at.z < z0 + size : w.owner.x === x && w.owner.z === z) primitives.push({ geometry: w.geometry, material: w.material, castShadow: w.castShadow, name: w.id, transform: w.transform, compactIndex: true, ...(w.customAttributes === undefined ? {} : { customAttributes: w.customAttributes }), ...(w.nativeAttributes === undefined ? {} : { nativeAttributes: w.nativeAttributes }), ...(w.extras === undefined ? {} : { extras: w.extras }) });
      const hasPanel = lod === 0 && panelFiles.some((p) => p.bounds !== null && p.bounds.max.x >= x0 && p.bounds.min.x <= x0 + size && p.bounds.max.z >= z0 && p.bounds.min.z <= z0 + size);
      if (primitives.length === 0 && !hasPanel) continue;
      const file = save(primitives, `props.${lod}.${x}.${z}`), cost = { ...parseGlb(assets.get(file.hash) ?? new Uint8Array()) };
      if (texture !== null) { cost.gpu += texture.gpu; cost.decoded += texture.decoded; }
      const prior = tiles.find((t) => t.lod === lod && t.x === x && t.z === z), row: Shardfile['tiles'][number] = prior ?? { lod, x, z, bounds: { min: [x0, 0, z0], max: [x0 + size, 0, z0 + size] }, geometricError: 0, files: [], compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 };
      row.files.push(file.hash); row.compressed += file.compressed + (texture?.compressed ?? 0); row.decoded += cost.decoded; row.gpu += cost.gpu; row.triangles += cost.triangles; row.draws += cost.draws;
      for (const primitive of primitives) { primitive.geometry.computeBoundingBox(); const box = primitive.geometry.boundingBox; if (box === null) continue;
        for (const matrix of primitive.instances ?? [primitive.transform ?? new Matrix4()]) { const world = box.clone().applyMatrix4(matrix); row.bounds.min[1] = Math.min(row.bounds.min[1], world.min.y); row.bounds.max[1] = Math.max(row.bounds.max[1], world.max.y); }
      }
      if (lod === 0) for (const panel of panelFiles) { const box = panel.bounds; if (box === null || box.max.x < x0 || box.min.x > x0 + size || box.max.z < z0 || box.min.z > z0 + size) continue; row.files.push(panel.file.hash); row.triangles += panel.file.triangles; row.draws += panel.file.draws; row.bounds.min[1] = Math.min(row.bounds.min[1], box.min.y); row.bounds.max[1] = Math.max(row.bounds.max[1], box.max.y); }
      const cap = lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
      const warnings = [
        ...(row.decoded + row.gpu > cap.resident ? [`resident ${row.decoded + row.gpu} > ${cap.resident}`] : []),
        ...(row.compressed > cap.compressed ? [`compressed ${row.compressed} > ${cap.compressed}`] : []),
        ...(row.triangles > cap.triangles ? [`triangles ${row.triangles} > ${cap.triangles}`] : []),
        ...(row.draws > cap.draws ? [`draws ${row.draws} > ${cap.draws}`] : []),
      ];
      if (warnings.length > 0) {
        tileWarnings.set(`${lod}/${x}/${z}`, warnings);
        console.warn(`Props tile ${lod}/${x}/${z}: ${warnings.join('; ')} (provisional caps)`);
      }
      if (prior === undefined) tiles.push(row); section.tiles.push({ lod, x, z, file: file.hash });
    }
  }
  // a section of whole shapes only has no far proxy: a whole shape is never decimated, and the far proxy is one capped draw
  const farTriangles = source.far === undefined ? [...base, ...scattered, ...panelTriangles] : vertices(source.far);
  let far: BakedProps['far'] = null;
  if (farTriangles.length > 0 || whole.length === 0) {
    const farGeometry = geometry(farTriangles);
    if (farGeometry.getAttribute('position').count === 0) throw new Error('Props far proxy must have geometry');
    farGeometry.computeBoundingBox(); const farBox = farGeometry.boundingBox; if (farBox === null) throw new Error('Missing far bounds');
    const farFile = save([{ geometry: farGeometry, material: mergedMaterial(), castShadow: false }], 'props.far'), proxy = { bounds: { min: farBox.min.toArray(), max: farBox.max.toArray() }, files: [farFile.hash], compressed: farFile.compressed + (texture?.compressed ?? 0), decoded: farFile.decoded, gpu: farFile.gpu + (texture?.gpu ?? 0), triangles: farFile.triangles, draws: farFile.draws };
    if (proxy.decoded + proxy.gpu > CONTENT_CAPS.far.resident || proxy.compressed > CONTENT_CAPS.far.compressed || proxy.triangles > CONTENT_CAPS.far.triangles || proxy.draws > CONTENT_CAPS.far.draws) throw new Error('Props far proxy exceeds content caps');
    section.far = farFile.hash; far = proxy;
  }
  for (const [kind, entries] of [['models', source.models ?? []]] as const) for (const entry of entries) {
    const file = save([{ geometry: geometry(vertices(entry.model)), material: mergedMaterial() }], entry.id); library.push(file.hash); section[kind].push({ id: entry.id, file: file.hash });
  }
  const libraryFiles = files.filter((f) => library.includes(f.hash) || (texture !== null && library.length > 0 && f.hash === texture.hash));
  if (libraryFiles.reduce((n, f) => n + f.decoded + f.gpu, 0) > CONTENT_CAPS.library.resident || libraryFiles.reduce((n, f) => n + f.compressed, 0) > CONTENT_CAPS.library.compressed) throw new Error('Props library exceeds content caps');
  const props = v.parse(PropsSchema, section), report = tiles.map((t) => {
    const warnings = tileWarnings.get(`${t.lod}/${t.x}/${t.z}`);
    return { lod: t.lod, x: t.x, z: t.z, resident: t.decoded + t.gpu, compressed: t.compressed, triangles: t.triangles, draws: t.draws,
      ...(warnings === undefined ? {} : { warnings }) };
  });
  return { props, tiles, files, library, far, assets, report };
}
