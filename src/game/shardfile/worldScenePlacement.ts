import { Matrix4, type Material, Color, type Group, InstancedMesh, Vector3 } from 'three';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { modelPoseMatrix } from '@wildshard/engine/models/placementBatch';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { Scope } from '@wildshard/engine/app/scope';
import { TIER } from '@wildshard/engine/core/tier';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { sharedModelContext } from '@wildshard/engine/models/model';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { CullOptions } from '@wildshard/engine/models/cull';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import { worldSceneSourceMaterial } from './worldSceneMaterials';
import type { WorldScenePlacementRow } from '@wildshard/format/worldScenePlacement';
import type { ShardContext } from '../plugin/context';
import type { defineWorldSceneCatalogue } from '../models/worldSceneCatalogue';
import type { SceneHandles } from './sceneHandles';
import { bucketByTile, colliderTileKeys, SharedTileBuilds } from './tileContent';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

/** The collider rows a scene placement may author (`readColliderRows`). */
const COLLIDER_ROWS = { kinds: ['box', 'treads', 'hull', 'capsule', 'ball', 'trimesh'], surfaces: ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] } as const;
/** A collider-only piece's anchor (T3): the middle of its colliders' points. */
export function anchorOf(rows: readonly ColliderDesc[]): Vector3 {
  const at = new Vector3();
  for (const row of rows) { const point = row.kind === 'treads' ? row.from : row; at.x += point.x; at.y += point.y; at.z += point.z; }
  return at.divideScalar(Math.max(1, rows.length));
}

function requireLive(owner: Scope): void { if (owner.disposed) throw new Error('Scene placement owner is disposed'); }
/** An authored copy as the model placer takes it: its fields, its tint and its pose matrix. */
function posed(authored: WorldScenePlacementRow['poses'][number]) {
  const tint = authored.color === undefined ? {} : { color: new Color(authored.color[0], authored.color[1], authored.color[2]) };
  if ('matrix' in authored) { const { color: _tint, ...pose } = authored; return { ...pose, ...tint, matrix: new Matrix4().fromArray(authored.matrix) }; }
  const { yxz, color: _tint, ...pose } = authored; const { yawAtan2, ...rotation } = yxz;
  const yaw = yawAtan2 === undefined ? rotation.yaw : Math.atan2(yawAtan2[0], yawAtan2[1]);
  return { ...pose, ...tint, matrix: modelPoseMatrix({ ...pose, ...rotation, yaw }) };
}

/** Client-only deferred placement, stored in SceneHandles alongside its published parts.
 * Construction order follows callers' named steps; a resident row builds at most once.
 *
 * Tile streaming T3 (G652): a placement may instead build by tile (`tiles()` / `attach`), each tile's copies alone (one
 * merged draw or instanced set per tile) with their colliders, all owned by the tile's scope, under one stable container. */
export class WorldScenePlacement {
  private pending: Promise<Placed> | undefined;
  private buckets: Map<number, number[]> | undefined;
  private shared: SharedTileBuilds<Placed> | undefined;
  private authored: Map<number, ColliderDesc[]> | undefined;
  constructor(private readonly ctx: ShardContext, private readonly row: WorldScenePlacementRow,
    private readonly catalogue: Pick<ReturnType<typeof defineWorldSceneCatalogue>, 'model'>, private readonly owner: Scope,
    private readonly materials: Map<string, Material>, private readonly sources: readonly Extract<WorldScenesSection['materials'][number], { kind: 'source' }>[], private readonly handles?: Pick<SceneHandles, 'object'>) {}

  load(): Promise<Placed> {
    if (this.owner.disposed) return Promise.reject(new Error('Scene placement owner is disposed'));
    this.pending ??= this.build(null, this.owner);
    return this.pending;
  }
  /** T3: the scene part a set draws this placement's copies into (`drawnInto`), if any: by tile, such a placement carries
   *  only its copies' colliders and tap boxes; the set keeps drawing them. */
  drawnInto(): string | undefined { return this.row.drawnInto?.part; }
  /** The model its copies are (the placed model's id, as `load()`'s `Placed.model`). */
  modelId(): string { return this.catalogue.model(this.row.model).id; }
  /** T3: the tiles (keys j * 8 + i, cell-local) holding this placement's copies, or reached by its authored colliders. */
  tiles(): ReadonlySet<number> { return new Set([...this.bucketed().keys(), ...this.authoredByTile().keys()]); }
  /**
   * T3: build this placement's copies in `tile` under `scope` (their draws join `container`, the placement's stable object;
   * a placement drawn into a set registers only their colliders and boxes); the scope's end takes them away. Null when
   * the tile holds none of its copies.
   */
  async attach(tile: number, scope: Scope, container: Group | null): Promise<Placed | null> {
    if (!this.bucketed().has(tile)) return null;
    if (this.pending !== undefined) throw new Error('Scene placement is built whole');
    const placed = await this.tileBuilds().hold(tile, scope);
    if (scope.disposed || this.row.drawnInto !== undefined) return placed;
    if (container === null) throw new Error('Scene placement by tile needs its container');
    // the container stands where the registry parents a placed object (the world), so its tiles draw where a whole one would
    if (container.parent === null && placed.object.parent !== null) placed.object.parent.add(container);
    container.add(placed.object); scope.onDispose(() => { placed.object.removeFromParent(); });
    return placed;
  }
  /**
   * T3 (the collider ring, D2 B): the tile's colliders, apart from its draws: its copies' own (from the tile's one shared
   * build) and the row's authored ones whose footprint reaches the tile (`colliderTileKeys`: none missing at a ring edge),
   * on a piece of their own under `scope`.
   */
  async attachColliders(tile: number, scope: Scope): Promise<void> {
    const world = this.ctx.game.runtime?.world, row = this.row;
    if (world === undefined || world === null) throw new Error('Scene placement needs its resident world');
    const own = this.bucketed().has(tile) ? (await this.tileBuilds().hold(tile, scope)).colliders : [];
    const authored = this.authoredByTile().get(tile) ?? [];
    if (scope.disposed || own.length + authored.length === 0) return;
    const definition = this.catalogue.model(row.model), id = `${row.piece?.id ?? definition.id}.c${String(tile)}`;
    withOwner(scope, () => world.registry.add({ id, name: row.piece?.name ?? definition.name, category: definition.category, file: definition.file,
      anchor: anchorOf([...own, ...authored]), colliders: [...own, ...authored],
      ...(definition.surface === undefined ? {} : { surface: definition.surface }),
      ...(row.piece?.solidFloor === undefined ? {} : { solidFloor: row.piece.solidFloor }),
      ...(row.piece?.floors === undefined ? {} : { floor: this.floorAt.bind(this) }) }));
  }
  /** T3: one build of a tile's copies (draws, picks, computed colliders) shared by its render and collider holds */
  private tileBuilds(): SharedTileBuilds<Placed> {
    this.shared ??= new SharedTileBuilds(this.owner, (tile, scope) => {
      const copies = this.bucketed().get(tile);
      return copies === undefined ? Promise.reject(new Error('Scene placement tile has no copies')) : this.build(copies, scope, tile);
    });
    return this.shared;
  }
  /** T3: the row's authored colliders by every tile their footprint reaches */
  private authoredByTile(): Map<number, ColliderDesc[]> {
    if (this.authored !== undefined) return this.authored;
    const byTile = new Map<number, ColliderDesc[]>();
    for (const shape of this.row.colliders === undefined ? [] : readColliderRows(this.row.colliders, COLLIDER_ROWS)) {
      for (const key of colliderTileKeys(shape)) { const list = byTile.get(key); if (list === undefined) byTile.set(key, [shape]); else list.push(shape); }
    }
    this.authored = byTile;
    return byTile;
  }
  private bucketed(): Map<number, number[]> {
    this.buckets ??= bucketByTile(this.row.poses, pose => pose);
    return this.buckets;
  }
  /** Query the same authored floor the placement lends to its registry piece. */
  floorAt(x: number, z: number): number | undefined { return floorAtRects(this.row.piece?.floors ?? [], x, z, this.row.piece?.floorPolicy ?? 'first'); }
  /** The whole placement (`copies` null) or one tile's copies, built under `owner`. */
  private async build(copies: readonly number[] | null, owner: Scope, tile?: number): Promise<Placed> {
    const world = this.ctx.game.runtime?.world, row = this.row;
    if (world === undefined || world === null || owner.disposed) throw new Error('Scene placement needs its resident world');
    const poses = copies === null ? row.poses : copies.map(index => { const pose = row.poses[index]; if (pose === undefined) throw new Error('Scene placement copy differs'); return pose; });
    const boxes = row.drawnInto === undefined ? undefined : copies === null ? row.drawnInto.boxes : copies.flatMap(index => row.drawnInto?.boxes.slice(index * 6, index * 6 + 6) ?? []);
    const borrowed = row.drawnInto === undefined ? undefined : this.handles?.object(row.drawnInto.part);
    if (row.drawnInto !== undefined && borrowed === undefined) throw new Error('Scene placement needs its named part owner');
    await Promise.all(this.sources.map(async source => {
      if (this.materials.has(source.id)) return;
      const material = await worldSceneSourceMaterial(source, world.sky, this.owner);
      this.materials.set(source.id, material);
    }));
    requireLive(owner);
    const { far, minAngular, view, ...policy } = row.cull ?? {};
    const cull: CullOptions = { ...policy,
      ...(far === undefined ? {} : { far: typeof far === 'number' ? far : far[TIER] }),
      ...(minAngular === undefined ? {} : { minAngular: typeof minAngular === 'number' ? minAngular : minAngular[TIER] }),
      ...(view === undefined ? {} : { view: world.forest }) };
    const definition = this.catalogue.model(row.model);
    const preplaced = row.colliders === undefined ? undefined : readColliderRows(row.colliders, COLLIDER_ROWS)
      // Keep the authored descriptor's field order as well as its typed lanes; exact native parity hashes both.
      .map((shape, i) => { const ordered = {}; return Object.assign(ordered, row.colliders?.[i], shape); });
    const pieceId = row.piece === undefined || tile === undefined ? row.piece?.id : `${row.piece.id}.t${tile}`;
    const placed = withOwner(owner, () => place(preplaced === undefined ? definition : { ...definition, colliders: () => [] },
      poses.map(posed),
      // E271 / E272: no multi-draw anywhere; a 'batched' row draws instanced (a graph look on a multi-draw batch did not compile)
      { ctx: sharedModelContext(world.sky, world.game), registry: world.registry, draw: row.draw === 'batched' ? 'instanced' : row.draw,
        ...(boxes === undefined || borrowed === undefined ? {} : { drawnInto: { object: borrowed, boxes: Float32Array.from(boxes) } }),
        ...(row.cull === undefined ? {} : { cull }), ...(row.sortObjects === undefined ? {} : { sortObjects: row.sortObjects }),
        ...(row.piece === undefined && preplaced === undefined && tile === undefined ? {} : { piece: { ...(pieceId === undefined ? {} : { id: pieceId }), ...(row.piece?.name === undefined ? {} : { name: row.piece.name }),
          // T3: a tile's colliders go on the collider ring (`attachColliders`), never with its draws
          ...(tile !== undefined ? { collide: false as const } : preplaced === undefined ? {} : { colliders: preplaced }),
          ...(row.piece?.solidFloor === undefined ? {} : { solidFloor: row.piece.solidFloor }),
          ...(row.piece?.follows === undefined ? {} : { follows: row.piece.follows }),
          ...(row.piece?.floors === undefined ? {} : { floor: this.floorAt.bind(this) }),
          ...(row.piece?.split === undefined ? {} : { split: { every: row.piece.split, yieldTask: () => buildYield(owner) } }) } }) }));
    if (row.name !== undefined) {
      placed.object.name = row.name;
      const base = placed.object instanceof InstancedMesh ? placed.object : placed.object.children.find(child => child instanceof InstancedMesh);
      if (base !== undefined) base.name = row.name;
    }
    await placed.registered;
    await buildYield(owner);
    return placed;
  }
}
