/**
 * A baked ground (SHARD-PLATFORM M3; ex a dune shard's sand): the pieces a level whose ground is its compiled shardfile
 * terrain tiles draws round them, each driven by rows. Nothing here knows a shard.
 *
 * - `loadBakedMaps`: a set of offline-baked maps (each a zlib stream of the map's raw bytes) uploaded as DataTextures; a
 *   map that fails to load is a page fault (`console.error`) and stands in as one constant byte.
 * - `CubeSkirt`: the baked skirt past the ground's edge (a geometry pack), cut back to a grid cell's cube.
 * - `TintedTileGround`: the runtime-bound terrain tiles drawn in the caller's material with their baked vertex tint, the
 *   ground's queries and collider bound from the tiles' collider, the fine ring following the player.
 * - `mappedFamilyMaterial`: an engine family material whose texture refs name the caller's maps.
 */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, RGBAFormat, UnsignedByteType, type BufferGeometry, type Material, type Mesh, type Texture } from 'three';
import { GeometryPack, fetchDeflated, packedRows, type PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { Scope } from '@wildshard/engine/app/scope';
import type { PainterField } from '@wildshard/engine/render/look';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import type { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import { bindRuntimeProductTerrain } from '@wildshard/game/shardfile/runtimeProduct';
import type { Shardfile } from '@wildshard/format/shardSchema';

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
    const bytes = await fetchDeflated(url);
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

/** What owns the skirt's geometry: the look's level scope (only the verbs used here). */
export interface SkirtOwner { readonly disposed: boolean; own: (geometry: BufferGeometry) => BufferGeometry; onDispose: (fn: () => void) => void }

/**
 * G99 (every shard is a 500 m cube): the skirt past the ground's edge, baked as a geometry pack (geometry 0 the standalone
 * skirt, geometry 1 cut to the cube's `cubeHalf`). The look loads it and holds the mesh, so the plugin can swap in the cube's
 * cut in a grid cell (`fit`, once); released with its scope. A pack that fails to load is a page fault: no skirt draws.
 */
export class CubeSkirt {
  private held: { readonly mesh: Mesh; readonly cube: BufferGeometry; readonly half: number; readonly scope: SkirtOwner; fitted: boolean } | null = null;
  /** The look: load the pack (`fault` opens its page fault); the standalone skirt, or null when it did not load. */
  async load(url: string, rows: PackedGeometryJson & { readonly cubeHalf: number }, fault: string): Promise<{ standalone: BufferGeometry; cube: BufferGeometry; half: number } | null> {
    try {
      const pack = new GeometryPack(await fetchDeflated(url), packedRows(rows), 'skirt');
      return { standalone: pack.geometry(0), cube: pack.geometry(1), half: rows.cubeHalf };
    } catch (error: unknown) { console.error(fault, error); return null; }
  }
  /** The look: this level's skirt mesh and its cube cut (`half` its half width). */
  hold(mesh: Mesh, cube: BufferGeometry, half: number, scope: SkirtOwner): void {
    const entry = { mesh, cube, half, scope, fitted: false };
    this.held = entry;
    scope.onDispose(() => { cube.dispose(); if (this.held === entry) this.held = null; });
  }
  /** The plugin, in a grid cell: the skirt ends at the cube's edge (the baked cut's half width). */
  fit(half: number): void {
    const entry = this.held;
    if (entry === null || entry.scope.disposed || entry.fitted) return;
    if (half !== entry.half) throw new Error(`the skirt is baked for a ${String(entry.half)} m cube, not ${String(half)} m`);
    const old = entry.mesh.geometry;
    entry.mesh.geometry = entry.scope.own(entry.cube); entry.fitted = true;
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

/** Which runtime's tiles, where residency starts, how far (m) the player moves before the fine ring follows, the names its faults use. */
export interface TintedTileOptions { readonly source: Shardfile; readonly x: number; readonly z: number; readonly follow: number; readonly name: string; readonly tag: string }
type Bound = Awaited<ReturnType<typeof bindRuntimeProductTerrain>>;

/**
 * A ground drawn from its compiled shardfile terrain tiles and stood on from their collider, through the platform's
 * runtime-bound terrain (the same product reader standalone and in a grid cell, the shardfile's own residency rings). Each
 * tile is the engine's terrain tile view in the caller's material, its vertex tint the bake's; its normals are the shared
 * collider lattice's, so a tile edge across a crest lights as one surface. The tiles cast and receive no shadow.
 */
export class TintedTileGround {
  private live: { bound: Bound; x: number; z: number; busy: boolean } | null = null;
  constructor(private readonly options: TintedTileOptions) {}
  /** Bind the tiles under `scope` and hand their ground to the level frame (`field.bindGround`). */
  async bind(terrain: Terrain, field: PainterField, material: Material, scope: Scope): Promise<void> {
    const o = this.options;
    const bound = await bindRuntimeProductTerrain(scope, o.source, { x: o.x, z: o.z, terrain: (bytes, tileScope, _shadow, lattice) => {
      const mesh = installTerrainTile(decodeTerrainTile(bytes), { root: terrain.group, scope: tileScope, material, shadow: false, lattice });
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
