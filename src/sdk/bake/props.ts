import { Box3, BufferGeometry, Float32BufferAttribute, Matrix3, Matrix4, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3, type Object3D } from 'three';
import { CONTENT_CAPS, CELL_ABOVE, CELL_BELOW } from '@wildshard/engine/core/config';
import { PropsSchema, type ShardProps } from '@wildshard/game/shardfile/props';
import type { Shardfile } from '@wildshard/game/shardfile/schema';
import * as v from 'valibot';
import { parseGlb, parseKtx2 } from '../assets';
import { contentHash } from '../project';
import { staticGlb, type GlbPrimitive } from './glb';

/** A reusable scatter shape and its world-local positive TRS matrices; generators run only at build time. */
export interface PropScatter { model: Object3D; transforms: readonly Matrix4[] }
/** Trusted static content. Named panels remain separate, and coarse/far replacements are optional build-time inputs. */
export interface PropsBakeSource {
  static: Object3D; scatter?: readonly PropScatter[];
  panels?: readonly { id: string; model: Object3D; visible?: boolean }[]; colliders?: ShardProps['colliders']; models?: readonly { id: string; model: Object3D }[];
  coarse?: Object3D; far?: Object3D; family?: string; colourTexture?: Uint8Array;
}
/** Content-addressed GLBs and tile rows, including actual budget numbers and an independent far proxy. */
export interface BakedProps {
  props: ShardProps; tiles: Shardfile['tiles']; files: Shardfile['files']; library: string[];
  far: NonNullable<Shardfile['far']>; assets: Map<string, Uint8Array>;
  report: readonly { lod: number; x: number; z: number; resident: number; compressed: number; triangles: number; draws: number }[];
}
interface Vertex { p: Vector3; n: Vector3; c: Vector3; u: number; v: number }
function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
function vertices(root: Object3D, transform = new Matrix4()): Vertex[][] {
  root.updateMatrixWorld(true); const result: Vertex[][] = [];
  root.traverse((object) => {
    if (!isMesh(object)) return;
    if (object instanceof SkinnedMesh || Array.isArray(object.material) || !(object.material instanceof MeshStandardMaterial) || object.material.transparent || object.material.metalness !== 0 || object.material.roughness !== 1 || object.material.map !== null) throw new Error('Static merge needs opaque untextured nonmetal rough surfaces; bake textured shapes as scatter');
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
      const hasPanel = lod === 0 && panelFiles.some((p) => p.bounds !== null && p.bounds.max.x >= x0 && p.bounds.min.x <= x0 + size && p.bounds.max.z >= z0 && p.bounds.min.z <= z0 + size);
      if (primitives.length === 0 && !hasPanel) continue;
      const file = save(primitives, `props.${lod}.${x}.${z}`), cost = { ...parseGlb(assets.get(file.hash) ?? new Uint8Array()) };
      if (texture !== null) { cost.gpu += texture.gpu; cost.decoded += texture.decoded; }
      const prior = tiles.find((t) => t.lod === lod && t.x === x && t.z === z), row: Shardfile['tiles'][number] = prior ?? { lod, x, z, bounds: { min: [x0, 0, z0], max: [x0 + size, 0, z0 + size] }, geometricError: 0, files: [], compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 };
      row.files.push(file.hash); row.compressed += file.compressed + (texture?.compressed ?? 0); row.decoded += cost.decoded; row.gpu += cost.gpu; row.triangles += cost.triangles; row.draws += cost.draws;
      for (const primitive of primitives) { primitive.geometry.computeBoundingBox(); const box = primitive.geometry.boundingBox; if (box === null) continue;
        for (const matrix of primitive.instances ?? [new Matrix4()]) { const world = box.clone().applyMatrix4(matrix); row.bounds.min[1] = Math.min(row.bounds.min[1], world.min.y); row.bounds.max[1] = Math.max(row.bounds.max[1], world.max.y); }
      }
      if (lod === 0) for (const panel of panelFiles) { const box = panel.bounds; if (box === null || box.max.x < x0 || box.min.x > x0 + size || box.max.z < z0 || box.min.z > z0 + size) continue; row.files.push(panel.file.hash); row.triangles += panel.file.triangles; row.draws += panel.file.draws; row.bounds.min[1] = Math.min(row.bounds.min[1], box.min.y); row.bounds.max[1] = Math.max(row.bounds.max[1], box.max.y); }
      const cap = lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
      if (row.decoded + row.gpu > cap.resident || row.compressed > cap.compressed || row.triangles > cap.triangles || row.draws > cap.draws) throw new Error(`Props tile ${lod}/${x}/${z} exceeds content caps`);
      if (prior === undefined) tiles.push(row); section.tiles.push({ lod, x, z, file: file.hash });
    }
  }
  const farGeometry = geometry(source.far === undefined ? [...base, ...scattered, ...panelTriangles] : vertices(source.far));
  if (farGeometry.getAttribute('position').count === 0) throw new Error('Props far proxy must have geometry');
  farGeometry.computeBoundingBox(); const farBox = farGeometry.boundingBox; if (farBox === null) throw new Error('Missing far bounds');
  const farFile = save([{ geometry: farGeometry, material: mergedMaterial(), castShadow: false }], 'props.far'), far = { bounds: { min: farBox.min.toArray(), max: farBox.max.toArray() }, files: [farFile.hash], compressed: farFile.compressed + (texture?.compressed ?? 0), decoded: farFile.decoded, gpu: farFile.gpu + (texture?.gpu ?? 0), triangles: farFile.triangles, draws: farFile.draws };
  if (far.decoded + far.gpu > CONTENT_CAPS.far.resident || far.compressed > CONTENT_CAPS.far.compressed || far.triangles > CONTENT_CAPS.far.triangles || far.draws > CONTENT_CAPS.far.draws) throw new Error('Props far proxy exceeds content caps');
  section.far = farFile.hash;
  for (const [kind, entries] of [['models', source.models ?? []]] as const) for (const entry of entries) {
    const file = save([{ geometry: geometry(vertices(entry.model)), material: mergedMaterial() }], entry.id); library.push(file.hash); section[kind].push({ id: entry.id, file: file.hash });
  }
  const libraryFiles = files.filter((f) => library.includes(f.hash) || (texture !== null && library.length > 0 && f.hash === texture.hash));
  if (libraryFiles.reduce((n, f) => n + f.decoded + f.gpu, 0) > CONTENT_CAPS.library.resident || libraryFiles.reduce((n, f) => n + f.compressed, 0) > CONTENT_CAPS.library.compressed) throw new Error('Props library exceeds content caps');
  const props = v.parse(PropsSchema, section), report = tiles.map((t) => ({ lod: t.lod, x: t.x, z: t.z, resident: t.decoded + t.gpu, compressed: t.compressed, triangles: t.triangles, draws: t.draws }));
  return { props, tiles, files, library, far, assets, report };
}
