/**
 * The world-view half of a transitional region's shell (SHARD-PLATFORM SF47 / M3, E452): what a legacy shard's runtime
 * draws and collides with while it runs as a neighbour cell rather than as the page's home.
 *
 * The page keeps one renderer, scene, player and input loop. bootstrap's `registry.onAdd` closes over the HOME physics
 * and scene, so a region cannot share that registry: a piece the runtime registers would collide in the home world.
 * The view owns, per admitted cell,
 *
 * - a root group in the one page scene at the cell's render offset (its origin minus the home origin, the same offset
 *   the live session applies to the camera while the traveller is in that frame), so frame-local content draws in place;
 * - its own `WorldRegistry` whose listener writes the DESTINATION Physics (the region's frame-local world), the root,
 *   its moving pieces and its player floors (the region's `PlayerFrameQueries.platforms`);
 * - `enter(entry)`: while an entered runtime scope lives, the root is visible and the page registry verbs (`ctx.piece`,
 *   `place`, `activeRegistry()`) resolve to this registry, exactly as the frame's physics replaces the page's on a
 *   crossing. Prepared geometry may park across exits, but it is hidden on leave: an inactive neighbour displays only
 *   its shardfile / frozen declared content;
 * - disposal in dependency order: every piece's colliders and bodies leave the destination world, every object leaves
 *   the scene with its unacquired GPU resources, the registry binding is restored, and its residency hold is released.
 *
 * Memory: the view constructs nothing outside the whole measured runtime claim (`regionalRuntimeAccountedBytes`), which
 * the caller reserves on the page allocator before admission. The view refuses to exist without that live claim and
 * holds it against eviction for its lifetime. Generic game code: no shard is named here (E405).
 */
import { Group, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { currentOwner, withOwner } from '@wildshard/engine/app/ownership';
import { sceneResources } from '@wildshard/engine/app/sceneOwnership';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { addPiece } from '@wildshard/engine/physics/pieces';
import type { PlayerFrameQueries } from '@wildshard/engine/player/Player';
import { WorldRegistry, type Piece } from '@wildshard/engine/world/registry';
import type { GridCell } from './assembly';
import type { ResidencyAllocator, ResidencyLease } from './allocator';

/** The page's registry slot (`App.registryValue`): the frame that owns the traveller owns the registry verbs. */
export interface RegionalRegistrySlot { registryValue: WorldRegistry | null }
/** Which GPU resources the page's asset cache shares; those are never disposed with a region's tree. */
export interface RegionalAssets { isAcquired: (resource: object) => boolean }

export interface RegionalViewRequest {
  readonly cell: GridCell;
  /** The scene's frame: the home cell's grid origin. */
  readonly home: Readonly<{ x: number; z: number }>;
  /** The one page scene (no second renderer). */
  readonly scene: Object3D;
  /** The admitted region's own frame-local physics; never the page's home world. */
  readonly physics: Physics;
  readonly slot: RegionalRegistrySlot;
  readonly assets: RegionalAssets;
  /** The page allocator and the whole-runtime claim the caller reserved for this cell. */
  readonly allocator: ResidencyAllocator;
  readonly claim: ResidencyLease;
  /** The resident's scope; the view lives in a child and is disposed with it at the latest. */
  readonly scope: Scope;
  /** The admitted terrain and water inside the cell (frame-local). */
  readonly ground: Pick<PlayerFrameQueries, 'heightAt' | 'waterSurfaceAt'>;
  /** Subscribe the region's moving-piece poses to the fixed step's pre slot; returns the unsubscribe. */
  readonly fixedPre?: (run: () => void) => () => void;
}

/** Live counts a leak check compares against zero after leave. */
export interface RegionalViewCensus {
  readonly bodies: number; readonly colliders: number; readonly pieces: number; readonly objects: number;
  readonly movers: number; readonly platforms: number; readonly bound: boolean; readonly visible: boolean; readonly held: boolean;
}

export interface RegionalView {
  readonly scope: Scope;
  /** Frame-local content parent, already in the page scene at the cell's render offset. */
  readonly root: Group;
  readonly registry: WorldRegistry;
  /** The region's player frame: admitted ground and water plus registered floors. */
  readonly queries: PlayerFrameQueries;
  /** Show the parked root and route the page registry verbs here while `entry` (an entered runtime scope) lives. */
  enter: (entry: Scope) => void;
  /** Pose moving pieces (also run from `fixedPre` when supplied). */
  sync: () => void;
  census: () => RegionalViewCensus;
  dispose: () => void;
}

type Floor = NonNullable<Piece['floor']>;

/** Build a cell's world view on admission; dispose it on leave or eviction. */
export function createRegionalView(request: RegionalViewRequest): RegionalView {
  const { cell, physics, slot, assets, allocator, claim } = request;
  if (request.scope.disposed) throw new Error('Regional view requires a live resident scope');
  const entry = allocator.entries().find((row) => row.id === claim.id);
  if (entry === undefined || entry.owner !== cell.instance) throw new Error('Regional view requires its reserved whole-runtime claim');
  const scope = request.scope.child(`grid.view:${cell.instance}`);
  const root = new Group(); root.name = `region:${cell.instance}`;
  // Parked geometry stays hidden: an inactive neighbour shows only its shardfile / frozen declared content.
  root.visible = false;
  root.position.set(cell.origin.x - request.home.x, 0, cell.origin.z - request.home.z);
  const registry = new WorldRegistry();
  const movers = new Set<() => void>(), platforms: Floor[] = [];
  let bindings = 0, held = true;
  const unhold = claim.hold();
  const free = (tree: Object3D): void => {
    tree.removeFromParent();
    for (const resource of sceneResources(tree)) if (!assets.isAcquired(resource)) resource.dispose();
  };
  // Unwinds last (LIFO): the scene node, then the claim hold, after every piece scope below has released its handles.
  scope.onDispose(() => { held = false; unhold(); });
  scope.onDispose(() => {
    free(root); root.clear();
    registry.pieces.length = 0; registry.picks.length = 0; registry.sets.length = 0;
    movers.clear(); platforms.length = 0;
  });
  request.scene.add(root);
  root.updateMatrixWorld(true);
  const sync = (): void => { if (!scope.disposed) for (const move of movers) move(); };
  if (request.fixedPre !== undefined) scope.onDispose(request.fixedPre(sync));

  withOwner(scope, () => {
    registry.onAdd((piece) => {
      if (scope.disposed) throw new Error('Regional view left before registration');
      // Each piece owns its native handles in a child of the view; its registering owner can release it earlier.
      const pieceScope = scope.child(`grid.piece:${piece.id}`), owner = currentOwner();
      if (owner !== null && owner !== scope && !owner.disposed) {
        const forget = owner.capture('disposers', () => { pieceScope.dispose(); });
        pieceScope.onDispose(forget);
      }
      withOwner(pieceScope, () => {
        const object = piece.object;
        if (object !== undefined) { root.add(object); pieceScope.onDispose(() => { if (object.parent === root) free(object); }); } // already unmounted: its verb freed it
        const added = addPiece(physics, piece, root);
        if (added.body !== null || piece.active !== undefined) {
          movers.add(added.sync); pieceScope.onDispose(() => { movers.delete(added.sync); });
        }
        const floor = piece.floor;
        if (floor !== undefined && piece.solidFloor !== true) {
          platforms.push(floor);
          pieceScope.onDispose(() => { const i = platforms.indexOf(floor); if (i !== -1) platforms.splice(i, 1); });
        }
        pieceScope.onDispose(() => { const i = registry.pieces.indexOf(piece); if (i !== -1) registry.pieces.splice(i, 1); });
      });
    });
  });

  const queries: PlayerFrameQueries = { heightAt: request.ground.heightAt, waterSurfaceAt: request.ground.waterSurfaceAt, platforms };
  const enter = (owner: Scope): void => {
    if (scope.disposed || owner.disposed) throw new Error('Regional registry requires a live view and entry');
    const prior = slot.registryValue;
    if (prior === registry) throw new Error('Regional registry is already entered');
    slot.registryValue = registry; bindings++; root.visible = true;
    let restored = false;
    const restore = (): void => {
      if (restored) return; restored = true; bindings--;
      if (bindings === 0) root.visible = false;
      if (slot.registryValue === registry) slot.registryValue = prior;
    };
    const forgetEntry = owner.capture('disposers', restore);
    // A view disposed before its entry still hands the page its previous registry back.
    scope.onDispose(() => { forgetEntry(); restore(); });
  };
  return {
    scope, root, registry, queries, enter, sync,
    census: () => {
      const native = physics.scopedCensus(scope);
      return { bodies: native.bodies, colliders: native.colliders, pieces: registry.pieces.length, objects: root.children.length,
        movers: movers.size, platforms: platforms.length, bound: bindings > 0, visible: root.visible, held };
    },
    dispose: () => { scope.dispose(); },
  };
}
