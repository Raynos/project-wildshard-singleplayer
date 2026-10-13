import { NodeIO } from '@gltf-transform/core';
import { Color, Matrix4, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import type { PlaceholderTree } from '@wildshard/format/placeholderSource';
import { NEAR_PLACEHOLDER_LIMITS } from '@wildshard/format/nearPlaceholder';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { placeholderGeometry, type PlaceholderGrid, type PlaceholderLook, type PlaceholderLookRuntime, type PlaceholderPart } from '@wildshard/game/plugin/placeholder';
import { parseGlb } from '../assets';
import { encodeCanonicalJson, hashImmutableBytes } from '../immutable';
import { staticGlb } from './glb';
import { nearGroundReducer, nearPlaceholderParts, type NearPlaceholderOptions, type NearPlaceholderReport, type NearPrototype } from './nearPlaceholder';

/**
 * G348 (Jake: *"near and far placeholders are generic things that we're doing inside the engine for arbitrary shards
 * being loaded into the MMO"*): the far proxy (SF23) and the near placeholder (G342) of any shard, from its own height
 * grid, its own look and its own world. `wildshard build` bakes both for every shardfile project
 * (`projectPlaceholders`); the repo's runners (`scripts/bake/far-proxies.mjs`, `scripts/bake/near-placeholder.mjs`) call
 * the same bakers with what a shard declares in `data/placeholder.ts` (`@wildshard/format/placeholderSource`). Nothing
 * here knows a shard.
 */

/**
 * The near bake's budget (measured, G342): the ground sampled at the height field's own ~2 m (64 quads a 125 m region)
 * and reduced to `groundError` metres (round 3), a content triangle budget, a sanity triangle cap and the per-cell
 * resident ceiling. Round 3 (Jake: Nalati's terrain "super low poly") measured the dense ground at 0.5 m on 2026-10-12:
 * Nalati 24k triangles / 1.9 MB, Pine 20k / 1.67 MB, Driftwood 16k / 1.38 MB (the L1-density ground was 10k / 0.77 MB);
 * whole cells Nalati 5.47, Driftwood 5.81 and Pine 8.07 MB with its 40k props, so the ceiling went 6 → 8.5 MB
 * (coordinator approval, G342 / E435): four cells 34 MB on the near line, inside the 1.0 GB Explorer envelope.
 */
export const NEAR_BAKE = { quads: 64, groundError: 0.5, contentTriangles: 42_000, triangles: 160_000, residentBytes: 8_500_000 } as const;
/** The forest's triangle budget inside the near placeholder (on top of the props' own content budget). */
export const NEAR_TREE_TRIANGLES = 30_000;
/** Half a cell (m): copies leaving it are dropped. */
const HALF = 250;

/** One immutable file row of a baked placeholder GLB. */
export type PlaceholderFile = Shardfile['files'][number];
/** far.json: the shardfile `far` row, the GLB's file row and the runtime look. */
export interface FarManifest { far: NonNullable<Shardfile['far']>; file: PlaceholderFile; look: PlaceholderLookRuntime }
/** near.json: the near GLB's cost row (with its content and forest counts), its file row and the runtime look. */
export interface NearManifest {
  near: { files: string[]; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; content: number; trees?: number; treeTriangles?: number };
  file: PlaceholderFile; look: PlaceholderLookRuntime;
}

/** A placeholder's json row (`far.json` / `near.json`): canonical, sorted keys. */
export function placeholderJson(manifest: FarManifest | NearManifest): string { return encodeCanonicalJson(manifest); }

function fileRow(bytes: Uint8Array): PlaceholderFile {
  return { hash: hashImmutableBytes(bytes), kind: 'glb', compressed: bytes.length, ...parseGlb(bytes), dependencies: [], critical: false };
}
function oneDraw(geometry: ReturnType<typeof placeholderGeometry>, name: string): Uint8Array {
  return staticGlb([{ geometry, material: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true }), castShadow: false }], name);
}

/** Bake one far proxy: a single-draw GLB, refused over any §3.2 far cap. */
export function bakeFarPlaceholder(grid: PlaceholderGrid, look: PlaceholderLook, parts: readonly PlaceholderPart[] = []): { manifest: FarManifest; bytes: Uint8Array } {
  const geometry = placeholderGeometry(grid, look, parts);
  const bytes = oneDraw(geometry, 'far-proxy'), file = fileRow(bytes);
  geometry.computeBoundingBox(); const box = geometry.boundingBox; if (box === null) throw new Error('Missing far bounds');
  const far: NonNullable<Shardfile['far']> = { bounds: { min: box.min.toArray(), max: box.max.toArray() }, files: [file.hash], compressed: file.compressed, decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws };
  if (far.decoded + far.gpu > CONTENT_CAPS.far.resident || far.compressed > CONTENT_CAPS.far.compressed || far.triangles > CONTENT_CAPS.far.triangles || far.draws > CONTENT_CAPS.far.draws) throw new Error(`Far proxy exceeds content caps: ${JSON.stringify(far)}`);
  return { manifest: { far, file, look: { family: look.family, haze: look.haze, ...(look.grade === undefined ? {} : { grade: look.grade }), ...(look.band === undefined ? {} : { band: look.band }) } }, bytes };
}

/** A baked `terrain.bin` (the WSTR lattice) as a placeholder grid. */
export function bakedTerrainGrid(raw: Uint8Array): PlaceholderGrid {
  const grid = parseBakedTerrain(new Uint8Array(raw).buffer);
  if (grid === null) throw new Error('Unreadable terrain.bin');
  return { res: grid.res, size: grid.size, heights: grid.heights, splat: grid.splat.some((b, i) => i % 4 !== 0 && b > 0) ? grid.splat : null };
}

/** A shardfile terrain collider tile (the whole cell, centred on its origin) as a placeholder grid. */
export function colliderGrid(tileBytes: Uint8Array): PlaceholderGrid {
  const tile = decodeTerrainTile(tileBytes);
  if (tile.x !== -tile.size / 2 || tile.z !== -tile.size / 2) throw new Error('Terrain collider is not one centred cell');
  return { res: tile.resolution, size: tile.size, heights: tile.heights, splat: null };
}

/** One placed tree of a forest its shard's own model draws: cell-local, its height (m) and its tint's lightness. */
export interface PlaceholderTreePlacement { readonly x: number; readonly y: number; readonly z: number; readonly rot: number; readonly height: number; readonly scale: number; readonly species: string; readonly tint: number }
interface TreeShape { readonly stem: readonly [number, number, Color] | null; readonly rings: readonly (readonly [number, number])[]; readonly crown: Color }

const srgb = ([r, g, b]: readonly [number, number, number]): Color => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
/** The generic stand-in: a stemless two-ring conifer. */
const GENERIC_TREE: PlaceholderTree = { species: 'tree', stem: null, rings: [[0.06, 0.24], [0.45, 0.15]], crown: [76, 112, 66] };
const shapeFrom = (row: PlaceholderTree): TreeShape => ({ stem: row.stem === null ? null : [row.stem[0], row.stem[1], srgb(row.stem[2])], rings: row.rings, crown: srgb(row.crown) });
const trianglesOf = (shape: TreeShape): number => (shape.stem === null ? 0 : 8) + Math.max(0, shape.rings.length - 1) * 10 + (shape.rings.length > 0 ? 5 : 0);

function treePrototype(shape: TreeShape, shade: number, widen: number): { positions: Float32Array; colours: Float32Array; index: Uint32Array } {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const ring = (y: number, r: number, n: number, c: Color): number => { const b = pos.length / 3; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(c.r, c.g, c.b); } return b; };
  const side = (a: number, b: number, n: number): void => { for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; idx.push(a + k, b + k, b + k1, a + k, b + k1, a + k1); } };
  if (shape.stem !== null) { const [top, r, c] = shape.stem, a = ring(0, r, 4, c), b = ring(top, r, 4, c); side(a, b, 4); }
  if (shape.rings.length > 0) {
    const dark = shape.crown.clone().multiplyScalar(0.8 * shade), lit = shape.crown.clone().multiplyScalar(shade);
    let prev = -1;
    for (const [i, [y, r]] of shape.rings.entries()) { const b = ring(y, r * widen, 5, i === 0 ? dark : lit); if (prev >= 0) side(prev, b, 5); prev = b; }
    const apex = pos.length / 3; pos.push(0, 1, 0); col.push(lit.r, lit.g, lit.b);
    for (let k = 0; k < 5; k++) idx.push(prev + k, apex, prev + (k + 1) % 5);
  }
  return { positions: Float32Array.from(pos), colours: Float32Array.from(col), index: Uint32Array.from(idx) };
}

/**
 * G342: a forest's trees for the near placeholder. Each kept tree becomes a low-LOD stand-in (a unit-high stem and crown
 * of 8-23 triangles, by species and tint band) at its own placement, thinned evenly to the triangle budget, the kept ones
 * widened to cover the thinned ones' crowns. `stands` are the shard's declared shapes (`placeholder.trees`); a shard that
 * declares none gets one generic conifer. Deterministic for the same placements.
 */
export function nearTreePrototypes(trees: readonly PlaceholderTreePlacement[], half: number, stands: readonly PlaceholderTree[] | undefined, budget: number = NEAR_TREE_TRIANGLES): { prototypes: NearPrototype[]; report: { placed: number; inside: number; kept: number; widen: number } } {
  const rows = stands !== undefined && stands.length > 0 ? stands : [GENERIC_TREE], shapes = new Map(rows.map(row => [row.species, shapeFrom(row)]));
  const fallback = rows[0]?.species ?? GENERIC_TREE.species, speciesOf = (t: PlaceholderTreePlacement): string => shapes.has(t.species) ? t.species : fallback;
  const shapeOf = (species: string): TreeShape => shapes.get(species) ?? shapeFrom(GENERIC_TREE);
  const inside = trees.filter(t => Math.abs(t.x) < half - 1 && Math.abs(t.z) < half - 1);
  const total = inside.reduce((sum, t) => sum + trianglesOf(shapeOf(speciesOf(t))), 0), keep = Math.min(1, budget / Math.max(1, total));
  // a hash of each placement picks the kept share evenly across the cell
  const picked = inside.filter((t, i) => { const h = Math.sin(i * 12.9898 + t.x * 78.233 + t.z * 37.719) * 43758.5453; return h - Math.floor(h) < keep; });
  const widen = Math.min(1.7, Math.sqrt(1 / keep)), groups = new Map<string, PlaceholderTreePlacement[]>();
  for (const t of picked) {
    const key = `${speciesOf(t)}:${t.tint < 0.45 ? 0 : t.tint < 0.55 ? 1 : 2}`;
    const group = groups.get(key) ?? []; group.push(t); groups.set(key, group);
  }
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), prototypes: NearPrototype[] = [];
  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    const [species = fallback, band = '0'] = key.split(':'), shape = shapeOf(species);
    const proto = treePrototype(shape, [0.82, 1, 1.18][Number(band)] ?? 1, shape.rings.length === 0 ? 1 : widen);
    const transforms = (groups.get(key) ?? []).map((t) => {
      const h = t.height > 0 ? t.height : 20 * t.scale;
      return Array.from(m.compose(new Vector3(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), new Vector3(h, h, h)).elements);
    });
    prototypes.push({ name: `tree-${key}`, ...proto, transforms });
  }
  return { prototypes, report: { placed: trees.length, inside: inside.length, kept: picked.length, widen: Number(widen.toFixed(2)) } };
}

/** What `bakeNearPlaceholder` merges over the shard's ground. */
export interface NearPlaceholderInput {
  readonly grid: PlaceholderGrid;
  readonly look: PlaceholderLook;
  /** the shard's drawn static world as prototypes with their placed copies (cell-local) */
  readonly prototypes: readonly NearPrototype[];
  /** a forest its own tree model draws, placement by placement (empty: none) */
  readonly trees?: readonly PlaceholderTreePlacement[];
  /** the shard's declared tree stand-ins (`placeholder.trees`) */
  readonly stands?: readonly PlaceholderTree[] | undefined;
  /** the ground's geometric error (m) and the cell's resident ceiling (bytes); default `NEAR_BAKE`'s */
  readonly groundError?: number; readonly residentBytes?: number;
  /** the shard's declared prototype floors (`placeholder.near.floors`), on top of the content budget */
  readonly floors?: NearPlaceholderOptions['floors'];
  /** progress lines (the runners print them) */
  readonly log?: (line: string) => void;
}

/**
 * Bake one near placeholder: the ground at the height field's own density reduced by geometric error, in the shard's far
 * look, with its world's prototypes and its forest's stand-ins merged in at a low LOD; one draw, regions in
 * TEXCOORD_0.x, no colliders. The content budget steps down until the whole cell fits its resident ceiling.
 */
export async function bakeNearPlaceholder(input: NearPlaceholderInput): Promise<{ bytes: Uint8Array; manifest: NearManifest; reduced: NearPlaceholderReport }> {
  const { grid, look, log } = input, trees = input.trees ?? [];
  const forest = trees.length === 0 ? null : nearTreePrototypes(trees, HALF, input.stands);
  if (forest !== null) log?.(`forest ${JSON.stringify(forest.report)}`);
  const treeParts = forest === null ? { parts: [], report: { triangles: 0 } }
    : await nearPlaceholderParts(forest.prototypes, { triangles: NEAR_TREE_TRIANGLES * 2, half: HALF, minSize: 0 });
  // a forest placed tree by tree replaces its far look's canopy lift
  const { canopyAt, ...bare } = look, nearLook: PlaceholderLook = forest === null || canopyAt === undefined ? { ...look, quads: NEAR_BAKE.quads } : { ...bare, quads: NEAR_BAKE.quads };
  const groundError = input.groundError ?? NEAR_BAKE.groundError, residentCeiling = input.residentBytes ?? NEAR_BAKE.residentBytes;
  const reduceGround = await nearGroundReducer(groundError);
  if (log !== undefined) {
    const cost = parseGlb(staticGlb([{ geometry: placeholderGeometry(grid, nearLook, [], NEAR_BAKE.triangles, reduceGround), material: new MeshStandardMaterial({ vertexColors: true }), castShadow: false }], 'near-ground'));
    log(`ground at ${groundError} m: ${cost.triangles} tris, resident ${((cost.decoded + cost.gpu) / 1e6).toFixed(3)} MB`);
  }
  let budget: number = NEAR_BAKE.contentTriangles;
  for (;;) {
    const { parts, report: reduced } = await nearPlaceholderParts(input.prototypes, { triangles: budget, half: HALF, ...(input.floors === undefined ? {} : { floors: input.floors }) });
    const bytes = oneDraw(placeholderGeometry(grid, nearLook, [...parts, ...treeParts.parts], NEAR_BAKE.triangles + treeParts.report.triangles, reduceGround), 'near-placeholder');
    const file = fileRow(bytes);
    if (file.decoded + file.gpu <= residentCeiling) {
      const near: NearManifest['near'] = { files: [file.hash], compressed: file.compressed, decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws, content: reduced.triangles,
        ...(forest === null ? {} : { trees: forest.report.kept, treeTriangles: treeParts.report.triangles }) };
      return { bytes, reduced, manifest: { near, file, look: { family: look.family, haze: look.haze, ...(look.grade === undefined ? {} : { grade: look.grade }) } } };
    }
    if (budget < 4000) throw new Error(`Near placeholder terrain alone exceeds ${residentCeiling} B`);
    budget = Math.floor(budget * 0.9);
  }
}

type Rgb = readonly [number, number, number];
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The far look of a shard that declares none (any shardfile, an uploaded unknown one included): its ground in its own
 * ambient ground colour easing to a neutral rock on steep slopes, its cliff in that rock, its haze its own first fog key.
 */
export function shardfileLook(shard: Shardfile): PlaceholderLook {
  const key = shard.look.keys[0], ground: Rgb = key?.ambient.ground ?? [0.32, 0.36, 0.24], rock: Rgb = [0.33, 0.31, 0.29];
  const fog = key?.fog;
  return {
    family: 'pbr',
    colourAt: (_x, _z, _h, slope) => mixRgb(ground, rock, Math.min(1, Math.max(0, (slope - 0.2) * 3))),
    cliff: { lip: rock, foot: mixRgb(rock, [0, 0, 0], 0.4) },
    haze: { colour: fog?.colour ?? [1, 1, 1], near: fog?.near ?? 160, far: fog?.far ?? 700, max: 1 },
  };
}

/**
 * A shardfile's drawn static world as near-placeholder prototypes: every mesh of its coarse (L1) tiles' GLBs, each
 * primitive one prototype at its node's world matrix, coloured by its base colour factor times its vertex colours.
 */
export async function shardfileWorld(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>): Promise<NearPrototype[]> {
  const glbs = new Set(shard.files.filter(file => file.kind === 'glb').map(file => file.hash)), io = new NodeIO(), out: NearPrototype[] = [];
  for (const tile of shard.tiles) {
    if (tile.lod !== 1) continue;
    for (const ref of tile.files) {
      const bytes = assets.get(ref);
      if (!glbs.has(ref) || bytes === undefined) continue;
      const document = await io.readBinary(Uint8Array.from(bytes));
      for (const node of document.getRoot().listNodes()) {
        const mesh = node.getMesh(); if (mesh === null) continue;
        const matrix = Array.from(node.getWorldMatrix());
        for (const [i, primitive] of mesh.listPrimitives().entries()) {
          const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices(), colour = primitive.getAttribute('COLOR_0');
          if (position === null || primitive.getMode() !== 4) continue;
          const factor = primitive.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1], count = position.getCount(), p = [0, 0, 0], c = [1, 1, 1, 1];
          const positions = new Float32Array(count * 3), colours = new Float32Array(count * 3);
          for (let v = 0; v < count; v++) {
            position.getElement(v, p); positions.set([p[0] ?? 0, p[1] ?? 0, p[2] ?? 0], v * 3);
            if (colour !== null) colour.getElement(v, c);
            colours.set([factor[0] * (c[0] ?? 1), factor[1] * (c[1] ?? 1), factor[2] * (c[2] ?? 1)], v * 3);
          }
          const index = indices === null ? Uint32Array.from({ length: count }, (_, k) => k) : Uint32Array.from({ length: indices.getCount() }, (_, k) => indices.getScalar(k));
          out.push({ name: `${ref.slice(0, 8)}:${node.getName()}:${String(i)}`, positions, colours, index, transforms: [matrix] });
        }
      }
    }
  }
  return out;
}

/**
 * G348: `wildshard build`'s placeholders for any shardfile with a terrain: its far proxy when it ships none, and its near
 * placeholder (one render-only GLB in `near.content`) when it declares none, both from its own terrain collider, its own
 * coarse tiles' meshes and its own look. A shard without a height field (an authored mesh world ships its own far) is
 * returned unchanged. New files are added to `assets` and the returned shardfile.
 */
export async function projectPlaceholders(shard: Shardfile, assets: Map<string, Uint8Array>): Promise<Shardfile> {
  const collider = shard.terrain === null ? undefined : assets.get(shard.terrain.collider);
  if (collider === undefined || (shard.far !== null && shard.near !== undefined)) return shard;
  const grid = colliderGrid(collider), look = shardfileLook(shard), files = [...shard.files];
  let far = shard.far, near = shard.near;
  if (far === null) {
    const baked = bakeFarPlaceholder(grid, look);
    far = baked.manifest.far; files.push(baked.manifest.file); assets.set(baked.manifest.file.hash, baked.bytes);
  }
  if (near === undefined) {
    const baked = await bakeNearPlaceholder({ grid, look, prototypes: await shardfileWorld(shard, assets), residentBytes: Math.min(NEAR_BAKE.residentBytes, NEAR_PLACEHOLDER_LIMITS.contentBytes) });
    const file = baked.manifest.file;
    if (!files.some(row => row.hash === file.hash)) files.push(file);
    assets.set(file.hash, baked.bytes); near = { version: 1, terrain: [], content: [file.hash] };
  }
  return { ...shard, files, far, near };
}
