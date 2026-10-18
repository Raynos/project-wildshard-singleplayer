import { Matrix4, type Material } from 'three';
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
import type { WorldSceneBatch } from './worldSceneBatch';

function requireLive(owner: Scope): void { if (owner.disposed) throw new Error('Scene placement owner is disposed'); }

/** Client-only deferred placement, stored in SceneHandles alongside its published parts.
 * Construction order follows callers' named steps; a resident row builds at most once. */
export class WorldScenePlacement {
  private pending: Promise<Placed> | undefined;
  constructor(private readonly ctx: ShardContext, private readonly row: WorldScenePlacementRow,
    private readonly catalogue: ReturnType<typeof defineWorldSceneCatalogue>, private readonly owner: Scope,
    private readonly materials: Map<string, Material>, private readonly sources: readonly Extract<WorldScenesSection['materials'][number], { kind: 'source' }>[], private readonly batch?: WorldSceneBatch) {}

  load(): Promise<Placed> {
    if (this.owner.disposed) return Promise.reject(new Error('Scene placement owner is disposed'));
    this.pending ??= this.build();
    return this.pending;
  }
  private async build(): Promise<Placed> {
    const world = this.ctx.game.runtime?.world, row = this.row;
    if (world === undefined || world === null || this.owner.disposed) throw new Error('Scene placement needs its resident world');
    await Promise.all(this.sources.map(async source => {
      if (this.materials.has(source.id)) return;
      const material = await worldSceneSourceMaterial(source, world.sky, this.owner);
      this.materials.set(source.id, material);
    }));
    requireLive(this.owner);
    const { far, minAngular, view, ...policy } = row.cull ?? {};
    const cull: CullOptions = { ...policy,
      ...(far === undefined ? {} : { far: typeof far === 'number' ? far : far[TIER] }),
      ...(minAngular === undefined ? {} : { minAngular: typeof minAngular === 'number' ? minAngular : minAngular[TIER] }),
      ...(view === undefined ? {} : { view: world.forest }) };
    const definition = this.catalogue.model(row.model);
    const preplaced = row.colliders === undefined ? undefined : readColliderRows(row.colliders, { kinds: ['box', 'treads', 'hull', 'capsule', 'ball', 'trimesh'], surfaces: ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'] })
      // Keep the authored descriptor's field order as well as its typed lanes; exact native parity hashes both.
      .map((shape, i) => { const ordered = {}; return Object.assign(ordered, row.colliders?.[i], shape); });
    const placed = withOwner(this.owner, () => place(preplaced === undefined ? definition : { ...definition, colliders: () => [] },
      row.poses.map(authored => {
        if ('matrix' in authored) return { ...authored, matrix: new Matrix4().fromArray(authored.matrix) };
        const { yxz, ...pose } = authored; const { yawAtan2, ...rotation } = yxz;
        const yaw = yawAtan2 === undefined ? rotation.yaw : Math.atan2(yawAtan2[0], yawAtan2[1]);
        return { ...pose, matrix: modelPoseMatrix({ ...pose, ...rotation, yaw }) };
      }),
      { ctx: sharedModelContext(world.sky, world.game), registry: this.ctx.app.registry, draw: row.draw,
        ...(this.batch === undefined ? {} : { batch: this.batch.reserve() }),
        ...(row.cull === undefined ? {} : { cull }), ...(row.sortObjects === undefined ? {} : { sortObjects: row.sortObjects }),
        ...(row.piece === undefined && preplaced === undefined ? {} : { piece: { ...(row.piece === undefined ? {} : { id: row.piece.id }), ...(row.piece?.name === undefined ? {} : { name: row.piece.name }),
          ...(preplaced === undefined ? {} : { colliders: preplaced }),
          ...(row.piece?.solidFloor === undefined ? {} : { solidFloor: row.piece.solidFloor }),
          ...(row.piece?.floors === undefined ? {} : { floor: (x: number, z: number) => floorAtRects(row.piece?.floors ?? [], x, z, row.piece?.floorPolicy ?? 'first') }),
          ...(row.piece?.split === undefined ? {} : { split: { every: row.piece.split, yieldTask: () => buildYield(this.owner) } }) } }) }));
    await placed.registered;
    await buildYield(this.owner);
    return placed;
  }
}
