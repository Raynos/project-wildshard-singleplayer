import { CHUNK_HALF, CONTENT_CAPS, ROAD_WIDTH } from '@wildshard/engine/core/config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { GridPoint } from './assembly';

const STRIP = (CONTENT_CAPS.pitch - CHUNK_HALF * 2 - ROAD_WIDTH) / 2;
function finite(point: Readonly<GridPoint>): void { if (![point.x, point.y, point.z].every(Number.isFinite)) throw new RangeError('Invalid grid point'); }
/** Distance from a cell's centre classifies its interior, easing strip and shared highway deck. */
export function gridZone(local: Readonly<GridPoint>): 'shard' | 'strip' | 'highway' {
  finite(local);
  const distance = Math.max(Math.abs(local.x), Math.abs(local.z));
  return distance <= CHUNK_HALF ? 'shard' : distance < CHUNK_HALF + STRIP ? 'strip' : 'highway';
}
/** Smoothly ease a lowered author cap (at most 14 m/s) to 30 m/s over the 20 m strip. */
export function gridHoverSpeed(local: Readonly<GridPoint>, shardCap = 14): number {
  finite(local);
  if (!Number.isFinite(shardCap) || shardCap <= 0 || shardCap > 14) throw new RangeError('Invalid shard hover cap');
  const t = Math.max(0, Math.min(1, (Math.max(Math.abs(local.x), Math.abs(local.z)) - CHUNK_HALF) / STRIP));
  return shardCap + (30 - shardCap) * t * t * (3 - 2 * t);
}
/**
 * Hit-delivery permission for one authoritative world. The traveller's geometric cell owns combat, independently
 * of the motor's 6/10 m frame hysteresis. Legacy env weapon requests carry actor.player; ordinary environmental
 * damage to the traveller uses the same gate. Terminal CombatPipeline.fall deliberately has its separate G129 path.
 * Regional actor objects (not repeated ids) provide local provenance; neighbours cannot damage another world's actors.
 */
export function installGridTravellerCombat(events: Events, scope: Scope, traveller: Actor, instance: string | (() => string | null),
  cellAtTraveller: () => string | null, actors?: ReadonlyMap<Actor, Readonly<GridPoint>> | (() => ReadonlyMap<Actor, Readonly<GridPoint>> | undefined)): void {
  if (scope.disposed) return;
  events.answer('damage.admit', request => {
    if (request === null) return null;
    const source = request.source === traveller || (request.source === 'env' && request.sourceTags.includes('actor.player'));
    const target = request.target === traveller;
    const local = typeof actors === 'function' ? actors() : actors;
    if (!source && !target && local === undefined) return request; // Preserve the page's independent local combat.
    const expected = typeof instance === 'function' ? instance() : instance;
    if (expected === null || cellAtTraveller() !== expected) return null;
    if (local !== undefined) {
      const localTarget = target ? undefined : local.get(request.target);
      if (!target && (localTarget === undefined || gridZone(localTarget) !== 'shard')) return null;
      if (!source && request.source !== 'env') {
        const localSource = local.get(request.source);
        if (localSource === undefined || gridZone(localSource) !== 'shard') return null;
      }
    }
    return request;
  }, scope);
}

/** Minimal board port supplied by the residency driver; no Player or browser dependency enters the grid policy. */
export interface GridHoverPort { hoverSpeedLimit: (() => number) | null }
/** Install the live deck/strip cap and restore the previous port when this residency scope leaves. */
export function installGridHoverSpeed(player: GridHoverPort, scope: Scope, read: () => { local: Readonly<GridPoint>; shardCap: number; onHighwayDeck: boolean }): void {
  if (scope.disposed) return;
  const previous = player.hoverSpeedLimit;
  const limit = () => {
    const state = read();
    const cap = gridHoverSpeed(state.local, state.shardCap);
    return gridZone(state.local) === 'highway' && !state.onHighwayDeck ? state.shardCap : cap;
  };
  player.hoverSpeedLimit = limit;
  scope.onDispose(() => { if (player.hoverSpeedLimit === limit) player.hoverSpeedLimit = previous; });
}
