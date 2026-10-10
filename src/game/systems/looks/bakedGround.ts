/**
 * A baked ground (SHARD-PLATFORM M3; ex a dune shard's sand): the pieces a level whose ground is its compiled shardfile
 * terrain tiles draws round them, each driven by rows. Nothing here knows a shard.
 *
 * - `loadBakedMaps`: a set of offline-baked maps (each a zlib stream of the map's raw bytes) uploaded as DataTextures; a
 *   map that fails to load is a page fault (`console.error`) and stands in as one constant byte.
 * - `swellSkirtAt` / `skirtGrid`: the skirt past the ground's edge, its edge heights easing into swells along the wind,
 *   as one indexed grid with smooth normals; `CubeSkirt` cuts it back to a grid cell's cube.
 * - `TintedTileGround`: the runtime-bound terrain tiles drawn in the caller's material with the caller's vertex tint, the
 *   ground's queries and collider bound from the tiles' collider, the fine ring following the player.
 * - `mappedFamilyMaterial`: an engine family material whose texture refs name the caller's maps.
 */
import { ClampToEdgeWrapping, DataTexture, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, UnsignedByteType, type BufferGeometry, type Color, type Material, type Mesh, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { PainterField } from '@wildshard/engine/render/look';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { decodeTerrainTile } from '@wildshard/engine/world/terrainTileData';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import type { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import { bindRuntimeProductTerrain } from '../../shardfile/runtimeProduct';
import type { Shardfile } from '../../shardfile/schema';

/** One baked map: its file (a zlib stream of `size`² × `channels` raw bytes), the byte a failed load stands in with, its sampling. */
export interface BakedMapRow {
  readonly url: string;
  readonly size: number;
  /** 1: a red mask (linear, clamped); 4: an RGBA tile (repeated, mipmapped) */
  readonly channels: 1 | 4;
  readonly standIn: number;
  /** the RGBA tile's anisotropy */
  readonly anisotropy?: number;
}

async function mapBytes(url: string, length: number, standIn: number, fault: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
    const bytes = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    if (bytes.length !== length) throw new Error(`${url}: ${String(bytes.length)} bytes, ${String(length)} baked`);
    return bytes;
  } catch (error: unknown) {
    console.error(fault, error);
    return new Uint8Array(length).fill(standIn);
  }
}

/** Every baked map of `rows`, uploaded; `fault` opens the page fault a failed map logs. */
export async function loadBakedMaps<K extends string>(rows: Readonly<Record<K, BakedMapRow>>, fault: string): Promise<Record<K, DataTexture>> {
  const keys = Object.keys(rows) as K[];
  const textures = await Promise.all(keys.map(async (key) => {
    const row = rows[key], bytes = await mapBytes(row.url, row.size * row.size * row.channels, row.standIn, fault);
    if (row.channels === 1) {
      const tex = new DataTexture(bytes, row.size, row.size, RedFormat, UnsignedByteType);
      tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping; tex.needsUpdate = true;
      return tex;
    }
    const tex = new DataTexture(bytes, row.size, row.size, RGBAFormat, UnsignedByteType);
    tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.anisotropy = row.anisotropy ?? 1; tex.needsUpdate = true;
    return tex;
  }));
  const out: Partial<Record<K, DataTexture>> = {};
  keys.forEach((key, i) => { const tex = textures[i]; if (tex !== undefined) out[key] = tex; });
  return out as Record<K, DataTexture>;
}

/**
 * The skirt's swells past the ground's square edge (half width `edge`): inside (`out < inside`) the ground's own height;
 * outside, the clamped edge height eased over `ease` metres into `base + swell · sin(2π (u + sin(v) · wobble))` along the
 * wind (u along it over `along` metres, v across it over `across`), lowered by `drop`.
 */
export interface SwellSkirtRow {
  readonly edge: number; readonly inside: number; readonly ease: number; readonly wind: readonly [number, number];
  readonly along: number; readonly across: number; readonly base: number; readonly swell: number; readonly wobble: number; readonly drop: number;
}

/** The skirt's height at (x, z) over `heightAt` (see `SwellSkirtRow`). */
export function swellSkirtAt(row: SwellSkirtRow, heightAt: (x: number, z: number) => number, x: number, z: number): number {
  const edge = row.edge, out = Math.max(Math.abs(x), Math.abs(z)) - edge;
  if (out < row.inside) return heightAt(x, z);
  const cx = Math.max(-edge, Math.min(edge, x)), cz = Math.max(-edge, Math.min(edge, z));
  const t = Math.min(1, Math.max(0, out / row.ease)), e = t * t * (3 - 2 * t);
  const wx = row.wind[0], wz = row.wind[1], u = (x * wx + z * wz) / row.along, v = (-x * wz + z * wx) / row.across;
  return heightAt(cx, cz) * (1 - e) + (row.base + row.swell * Math.sin((u + Math.sin(v) * row.wobble) * Math.PI * 2)) * e - row.drop;
}

/** The skirt grid: `cell` metres a quad, out to `reach` either side; inside the ground (`out < inside`) it sinks `sink` metres under it. */
export interface SkirtGridRow { readonly reach: number; readonly cell: number; readonly sink: number }

/** One indexed skirt grid with smooth normals, every vertex `colour`, standing on `skirt` (heights) and `heightAt` inside `swell.edge`. */
export function skirtGrid(row: SkirtGridRow, swell: SwellSkirtRow, heightAt: (x: number, z: number) => number, colour: Color, reach: number = row.reach): BufferGeometry {
  const n = Math.max(1, Math.round((reach * 2) / row.cell)), g = new PlaneGeometry(reach * 2, reach * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3), c = colour, edge = swell.edge;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), out = Math.max(Math.abs(x), Math.abs(z)) - edge;
    const y = out < swell.inside ? heightAt(x, z) - row.sink : swellSkirtAt(swell, heightAt, x, z);
    p.setY(i, y); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** What owns the skirt's geometry: the look's level scope (only the verbs used here). */
export interface SkirtOwner { readonly disposed: boolean; own: (geometry: BufferGeometry) => BufferGeometry; onDispose: (fn: () => void) => void }

/**
 * G99 (every shard is a 500 m cube): the skirt the look built before the level's context existed, held so the plugin can
 * cut it back to the cube in a grid cell (`fit`, idempotent per half width); released with its scope.
 */
export class CubeSkirt {
  private held: { readonly mesh: Mesh; readonly rebuild: (half: number) => BufferGeometry; readonly scope: SkirtOwner; half: number | null } | null = null;
  /** The look: this level's skirt and how to rebuild it out to a given half width. */
  hold(mesh: Mesh, rebuild: (half: number) => BufferGeometry, scope: SkirtOwner): void {
    const entry = { mesh, rebuild, scope, half: null };
    this.held = entry;
    scope.onDispose(() => { if (this.held === entry) this.held = null; });
  }
  /** The plugin, in a grid cell: rebuild the skirt to end at the cube's edge. */
  fit(half: number): void {
    const entry = this.held;
    if (entry === null || entry.scope.disposed || entry.half === half) return;
    const old = entry.mesh.geometry, geometry = entry.rebuild(half);
    entry.scope.own(geometry);
    entry.mesh.geometry = geometry; entry.half = half;
    old.dispose();
  }
  /** Tests and captures: the held skirt's horizontal reach (m) from the centre, or null when none is held. */
  reach(): number | null {
    const entry = this.held;
    if (entry === null) return null;
    const geometry = entry.mesh.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    return box === null ? null : Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
  }
}

/** A vertex's tint (linear RGB) at (x, z) and height h, written at `out[at..at+2]`. */
export type TileTint = (x: number, z: number, h: number, out: Float32Array, at: number) => void;
/** Which runtime's tiles, where residency starts, how far (m) the player moves before the fine ring follows, the names its faults use. */
export interface TintedTileOptions { readonly source: Shardfile; readonly x: number; readonly z: number; readonly follow: number; readonly name: string; readonly tag: string }
type Bound = Awaited<ReturnType<typeof bindRuntimeProductTerrain>>;

/**
 * A ground drawn from its compiled shardfile terrain tiles and stood on from their collider, through the platform's
 * runtime-bound terrain (the same product reader standalone and in a grid cell, the shardfile's own residency rings). Each
 * tile is the engine's terrain tile view in the caller's material, its vertex tint the caller's; its normals are the shared
 * collider lattice's, so a tile edge across a crest lights as one surface. The tiles cast and receive no shadow.
 */
export class TintedTileGround {
  private live: { bound: Bound; x: number; z: number; busy: boolean } | null = null;
  constructor(private readonly options: TintedTileOptions) {}
  /** Bind the tiles under `scope` and hand their ground to the level frame (`field.bindGround`). */
  async bind(terrain: Terrain, field: PainterField, material: Material, tint: TileTint, scope: Scope): Promise<void> {
    const o = this.options;
    const bound = await bindRuntimeProductTerrain(scope, o.source, { x: o.x, z: o.z, terrain: (bytes, tileScope, _shadow, lattice) => {
      const data = decodeTerrainTile(bytes), r = data.resolution, cell = data.size / (r - 1), colours = new Float32Array(r * r * 3);
      for (let z = 0; z < r; z++) for (let x = 0; x < r; x++) {
        const vertex = z * r + x;
        tint(data.x + x * cell, data.z + z * cell, data.heights[vertex] ?? 0, colours, vertex * 3);
      }
      const mesh = installTerrainTile({ ...data, colours }, { root: terrain.group, scope: tileScope, material, shadow: false, lattice });
      mesh.receiveShadow = false;
      return { mask: (excluded) => { maskTerrainTile(mesh, excluded); }, shadow: () => undefined };
    } });
    if (scope.disposed) throw new Error(`${o.name} left while binding its ground tiles`);
    if (field.bindGround === undefined) throw new Error(`${o.name} ground tiles need a live level frame (PainterField.bindGround)`);
    field.bindGround(bound.ground);
    const entry = { bound, x: o.x, z: o.z, busy: false };
    this.live = entry;
    scope.onDispose(() => { if (this.live === entry) this.live = null; });
  }
  /** Move the fine ring with the player (shard-local metres); a no-op unless the tiles are bound. */
  follow(x: number, z: number): void {
    const entry = this.live;
    if (entry === null || entry.busy || Math.hypot(x - entry.x, z - entry.z) < this.options.follow) return;
    entry.busy = true; entry.x = x; entry.z = z;
    void this.refresh(entry, x, z);
  }
  private async refresh(entry: { bound: Bound; busy: boolean }, x: number, z: number): Promise<void> {
    try { await entry.bound.refresh(x, z); }
    catch (error: unknown) { console.warn(`[${this.options.tag}] ground tiles refresh failed`, error); }
    finally { entry.busy = false; }
  }
}

/** An engine family material from `entry` whose texture refs name `maps`, freed with `scope`; `name` opens its missing-map error. */
export function mappedFamilyMaterial(entry: unknown, maps: Readonly<Record<string, Texture>>, scope: Scope, name: string, emissive?: EmissiveLook): Material {
  const material = familyMaterial(entry, { toon: new ToonLook(), ...(emissive === undefined ? {} : { emissive }), scope, textures: (ref) => {
    const t = maps[ref];
    if (t === undefined) throw new Error(`${name}: no texture ${ref}`);
    return t;
  } });
  scope.own(material);
  return material;
}
