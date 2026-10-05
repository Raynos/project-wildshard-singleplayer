import { CHUNK_HALF, CONTENT_CAPS, ROAD_WIDTH } from '@wildshard/engine/core/config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { GridCell, GridPoint } from './assembly';

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
/** Trusted residency provenance; an unbound, strip or highway actor cannot participate in grid combat. */
export interface GridPresence { readonly instance: string | null; readonly local: Readonly<GridPoint>; readonly readOnly: boolean }
/** Only the active writable shard interior accepts authoritative actions; visible neighbours are projections. */
export function gridCanAct(presence: GridPresence): boolean {
  return presence.instance !== null && presence.instance.length > 0 && !presence.readOnly && gridZone(presence.local) === 'shard';
}
/** Scope-owned combat gate keyed by actor objects, so identical entity ids in two instances never collide. */
export class GridCombatRules {
  private readonly actors = new WeakMap<Actor, () => GridPresence>();
  constructor(events: Events, scope: Scope) {
    events.answer('damage.admit', (request) => {
      if (request === null) return null;
      const target = this.actors.get(request.target)?.();
      if (target === undefined || !gridCanAct(target)) return null;
      if (request.source === 'env') return request;
      const source = this.actors.get(request.source)?.();
      return source !== undefined && gridCanAct(source) && source.instance === target.instance ? request : null;
    }, scope);
  }
  /** Install a live provenance reader; disposal removes only this registration, without disrupting a later rebind. */
  bind(actor: Actor, read: () => GridPresence, scope: Scope): void {
    if (scope.disposed) return;
    this.actors.set(actor, read);
    scope.onDispose(() => { if (this.actors.get(actor) === read) this.actors.delete(actor); });
  }
}
/**
 * Hit-delivery permission for one authoritative world. The traveller's geometric cell owns combat, independently
 * of the motor's 6/10 m frame hysteresis. Legacy env weapon requests carry actor.player; ordinary environmental
 * damage to the traveller uses the same gate. Terminal CombatPipeline.fall deliberately has its separate G129 path.
 * Regional actor objects (not repeated ids) provide local provenance; neighbours cannot damage another world's actors.
 */
export function installGridTravellerCombat(events: Events, scope: Scope, traveller: Actor, instance: string,
  cellAtTraveller: () => string | null, actors?: ReadonlyMap<Actor, Readonly<GridPoint>>): void {
  if (scope.disposed) return;
  events.answer('damage.admit', request => {
    if (request === null) return null;
    const source = request.source === traveller || (request.source === 'env' && request.sourceTags.includes('actor.player'));
    const target = request.target === traveller;
    if (!source && !target && actors === undefined) return request; // Preserve the page's independent local combat.
    if (cellAtTraveller() !== instance) return null;
    if (actors !== undefined) {
      const localTarget = target ? undefined : actors.get(request.target);
      if (!target && (localTarget === undefined || gridZone(localTarget) !== 'shard')) return null;
      if (!source && request.source !== 'env') {
        const localSource = actors.get(request.source);
        if (localSource === undefined || gridZone(localSource) !== 'shard') return null;
      }
    }
    return request;
  }, scope);
}

/** One rider and its optional mount form an indivisible cell-local crossing payload. */
export interface GridTravelMember { readonly id: string; readonly role: 'rider' | 'mount'; readonly position: Readonly<GridPoint>; readonly velocity: Readonly<GridPoint>; readonly yaw: number }
/** Prepared crossing keeps the stable destination id and all member poses; the physics owner commits motors together. */
export interface GridTravelUnit { readonly instance: string; readonly members: readonly GridTravelMember[] }
/** Validate the whole unit before preparing a frame change. Input members remain untouched on success or rejection. */
export function reframeGridUnit(unit: GridTravelUnit, from: GridCell, to: GridCell, readOnly = false): GridTravelUnit {
  if (readOnly || unit.instance !== from.instance || unit.members.length === 0 || unit.members.length > 2
    || unit.members.filter((member) => member.role === 'rider').length !== 1
    || unit.members.filter((member) => member.role === 'mount').length > 1
    || new Set(unit.members.map((member) => member.id)).size !== unit.members.length) throw new RangeError('Invalid grid travel unit');
  for (const member of unit.members) {
    finite(member.position); finite(member.velocity);
    if (member.id.length === 0 || !Number.isFinite(member.yaw)) throw new RangeError('Invalid grid travel member');
  }
  finite(from.origin); finite(to.origin);
  if (to.instance.length === 0) throw new RangeError('Invalid destination instance');
  const dx = from.origin.x - to.origin.x, dz = from.origin.z - to.origin.z;
  return Object.freeze({ instance: to.instance, members: Object.freeze(unit.members.map((member) => Object.freeze({ ...member,
    position: Object.freeze({ x: member.position.x + dx, y: member.position.y, z: member.position.z + dz }),
    velocity: Object.freeze({ ...member.velocity }) }))) });
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
