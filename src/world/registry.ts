/**
 * The world registry (PHYSICS.md P2b, ENGINE-FIT E1): one `add(piece)` per built thing, and everything that needs the
 * list of built things listens here instead of being wired by hand in main.ts — the scene, the physics world (the
 * piece's `ColliderDesc`s become Rapier colliders in src/physics/pieces.ts), the player's floors while the P2 bridge
 * lasts, the ocean's foam rings — and Explore World (X10): a piece with `model` is a model in the Model Explorer's
 * catalog, and `models()` / `picks` are what src/explore/registry.ts serves. One list: a built thing is registered once
 * and is drawn, collides and is explorable from that one `add`.
 *
 * `ColliderDesc` is engine-neutral data: builders emit it beside the geometry they draw and never import Rapier.
 */
import type * as THREE from 'three';
import type { Material } from '../physics/surface';
import type { Tier } from '../core/tier';
import { shardSlot } from '../core/shardState';

interface Vec3 { x: number; y: number; z: number }
interface Quat { x: number; y: number; z: number; w: number }

/** How a collider is placed: a centre, and either a turn about +Y (three's convention) or a full rotation. */
interface Placed { x: number; y: number; z: number; yaw?: number; rot?: Quat; surface?: Material }

export type ColliderDesc =
  /** a box: half-extents along its own axes */
  | Placed & { kind: 'box'; hx: number; hy: number; hz: number }
  /** an upright capsule (or tilted by `rot`): the straight part's half-height, the radius */
  | Placed & { kind: 'capsule'; halfHeight: number; radius: number }
  | Placed & { kind: 'ball'; radius: number }
  /** a convex hull of points given relative to (x, y, z) */
  | Placed & { kind: 'hull'; points: Float32Array }
  /** a triangle mesh relative to (x, y, z) — only where you walk inside or over irregular geometry */
  | Placed & { kind: 'trimesh'; vertices: Float32Array; indices: Uint32Array }
  /**
   * a stair: `count` boxes rising `rise` each from `from` (the foot of the first tread) toward `to` (the top edge,
   * at from.y + count × rise), `width` across — built as treads, never as a ramp (PHYSICS.md: autostep climbs them).
   */
  | { kind: 'treads'; from: Vec3; to: Vec3; width: number; count: number; surface?: Material };

export type PieceCategory = 'buildings' | 'nature' | 'props' | 'creatures' | 'ground';

/** Explore's catalog tabs */
export type ModelCategory = 'buildings' | 'nature' | 'creatures';

/** A piece as a model in Explore's catalog (every field defaults from the piece). */
export interface ModelEntry {
  /** the catalog id, when it differs from the piece's (one catalog entry for all the jetties) */
  id?: string;
  category?: ModelCategory;
  /** true (default): the model is the piece's `object`, already in the scene; false: `object()` builds one on first view */
  live?: boolean;
  object?: () => THREE.Object3D;
  /** a batch member's builder at a given detail tier (DETAIL TIERS); absent → one build for every tier */
  buildAt?: (tier: Tier) => THREE.Object3D;
}

/** a model in Explore's catalog, as it reads it (`WorldRegistry.models()`) */
export interface RegisteredModel {
  id: string;
  name: string;
  category: ModelCategory;
  /** the source module an agent edits for this model */
  file: string;
  /** true: `object()` is already in the scene (the Model Explorer isolates it in place) */
  live: boolean;
  object: () => THREE.Object3D;
  buildAt?: (tier: Tier) => THREE.Object3D;
}

/** a tap target that is not a registered model's own object: a batch mesh (one palm out of all of them) */
export interface RegisteredPick {
  object: THREE.Object3D;
  /** the registered model a hit on it opens */
  entry: string;
  /** the selection box for a hit at `point`; default: the object's box */
  boxAt?: (point: THREE.Vector3) => THREE.Box3;
}

export interface Piece {
  id: string;
  name: string;
  category: PieceCategory;
  /** the source module an agent edits for it */
  file: string;
  /** what's drawn; added to the scene by the registry's scene listener */
  object?: THREE.Object3D;
  /** where it stands (Explore's VIEW IN WORLD); defaults to the object's bounds' centre */
  anchor?: THREE.Vector3;
  /** static collision, in world space */
  colliders?: ColliderDesc[];
  /** what the colliders are made of, unless a desc says otherwise */
  surface?: Material;
  /**
   * The piece's floor as a function (decks, terraces, stairs as a ramp): placement (quest props, spawns) and footsteps
   * read it through `registry.floorAt`. Unless `solidFloor`, the player also stands on it (the P2 bridge).
   */
  floor?: (x: number, z: number) => number | undefined;
  /** the floor is in `colliders` as real geometry (P4 / P3): the player walks on those, not on `floor` */
  solidFloor?: boolean;
  /**
   * A piece that moves (the boat on the swell): its `colliders` are given in `follows`'s LOCAL frame and ride a
   * kinematic body posed from `follows`'s world transform every fixed step; a character standing on it is carried.
   */
  follows?: THREE.Object3D;
  /** a following piece that collides only while this says so (a door mid-swing is let through, never pins anyone) */
  active?: () => boolean;
  /** Explore's catalog lists it (`models()`); a model-only piece (one palm out of a batch) has no object / colliders */
  model?: ModelEntry;
}

export class WorldRegistry {
  readonly pieces: Piece[] = [];
  /** Explore's tap targets on batch meshes */
  readonly picks: RegisteredPick[] = [];
  private readonly listeners: ((p: Piece) => void)[] = [];

  /** Register a built thing: every listener sees it now; later listeners see it on subscribe. */
  add<P extends Piece>(piece: P): P {
    this.pieces.push(piece);
    for (const l of this.listeners) l(piece);
    return piece;
  }

  /** Called for every piece already added and every one added after. */
  onAdd(fn: (p: Piece) => void): void {
    this.listeners.push(fn);
    for (const p of this.pieces) fn(p);
  }

  get(id: string): Piece | undefined { return this.pieces.find((p) => p.id === id); }

  /** Explore's catalog: every piece with a `model`, once per catalog id (a later registration replaces an earlier one in place). */
  models(): RegisteredModel[] {
    const out: RegisteredModel[] = [], at = new Map<string, number>();
    for (const p of this.pieces) {
      const m = p.model, object = m?.object ?? (p.object ? ((o: THREE.Object3D) => () => o)(p.object) : undefined);
      if (!m || !object) continue;
      const id = m.id ?? p.id, category = m.category ?? (p.category === 'nature' || p.category === 'creatures' ? p.category : 'buildings');
      const e: RegisteredModel = { id, name: p.name, category, file: p.file, live: m.live ?? true, object, ...(m.buildAt ? { buildAt: m.buildAt } : {}) };
      const i = at.get(id);
      if (i === undefined) { at.set(id, out.length); out.push(e); } else out[i] = e;
    }
    return out;
  }

  addPick(p: RegisteredPick): void { this.picks.push(p); }

  /** The highest piece floor at (x, z), for placement; undefined off every piece. */
  floorAt(x: number, z: number): number | undefined {
    let best: number | undefined;
    for (const p of this.pieces) { const y = p.floor?.(x, z); if (y !== undefined && (best === undefined || y > best)) best = y; }
    return best;
  }
}

let running: WorldRegistry | null = null;
/** The running game's registry (bootstrap takes it); one is made on first use (a test, a tool). */
export function activeRegistry(): WorldRegistry { running ??= new WorldRegistry(); return running; }

/** A hand-made `Collider` box (Y-rotated by −rot, with yTop / yBottom, the P2-era format) as a `ColliderDesc`. */
export function boxDesc(c: { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }, surface?: Material): ColliderDesc {
  return { kind: 'box', x: c.x, y: (c.yTop + c.yBottom) / 2, z: c.z, hx: c.hw, hy: Math.max(0.005, (c.yTop - c.yBottom) / 2), hz: c.hd, yaw: -c.rot, ...(surface === undefined ? {} : { surface }) };
}

// E155 (src/core/shardState.ts): each resident shard has its own registry; a new shard starts with none (made on first use)
shardSlot<WorldRegistry | null>('world.registry', () => running, (v) => { running = v; }, () => null);
