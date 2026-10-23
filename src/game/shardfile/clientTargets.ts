import * as v from 'valibot';
import { CombatTargetRowsSchema } from '@wildshard/format/targets';
import type { RayTargets } from '@wildshard/engine/combat/targets';
import type { ArenaRoomEncounter } from '../boss/arenaRoom';
import type { TimedEncounters } from '../boss/timedEncounters';
import type { CrowdWeaponTarget, ForagerTargets } from './crowdRuntime';
import type { ShardContext } from '../plugin/context';
import type { PageWildlife } from '../population/wildlife';
import type { CrowdDraw } from '../ambient/crowdDraw';
import { installEnteredLevelService } from '../shard/retainedHooks';

/** Borrow original native projections; rows never provide a callback or factory. */
export type CombatTargetOwner = Pick<CrowdWeaponTarget<ForagerTargets>, 'raycast'>
  | Pick<TimedEncounters, 'target'> | Pick<ArenaRoomEncounter, 'target' | 'lockTarget'>;

/** Register ordered native target refinements in the original entered lifetime.
 * All ids and methods resolve before registration. Every query checks the whole
 * borrowed bank before any target call, and again between native calls. */
export function installCombatTargets(ctx: Pick<ShardContext, 'scope'> & { readonly app: Pick<ShardContext['app'], 'events'> }, input: unknown,
  owners: ReadonlyMap<string, CombatTargetOwner>, population?: { readonly wildlife: PageWildlife<CrowdDraw> | null }): void {
  const rows = v.parse(CombatTargetRowsSchema, input), scope = ctx.scope, events = ctx.app.events;
  const resolve = (id: string) => {
    const owner = owners.get(id);
    if (owner === undefined) throw new Error(`Missing combat target owner: ${id}`);
    const ray = 'raycast' in owner ? owner.raycast : owner.target;
    const lock = 'lockTarget' in owner ? owner.lockTarget : undefined;
    if (typeof ray !== 'function' || lock !== undefined && typeof lock !== 'function') throw new Error('Invalid combat target methods');
    return { id, owner, ray, lock, current: (): boolean => owners.get(id) === owner
      && ('raycast' in owner ? owner.raycast : owner.target) === ray && ('lockTarget' in owner ? owner.lockTarget : undefined) === lock };
  };
  const rays = rows.ray?.sources.map(resolve) ?? [], locks = rows.aim?.append.map(resolve) ?? [];
  if (rows.ray?.requires !== undefined && population === undefined) throw new Error('Combat targets require the native population loan');
  if (locks.some(source => source.lock === undefined)) throw new Error('Combat aim owner has no lock target');
  const validate = (): void => {
    if (scope.disposed || scope.disposing || ctx.scope !== scope || ctx.app.events !== events
      || [...rays, ...locks].some(source => !source.current())) throw new Error('Combat target owner left or changed');
  };
  validate();
  installEnteredLevelService(ctx, entered => {
    validate();
    if (rows.ray !== undefined) {
      const row = rows.ray;
      events.answer('combat.targets.ray', (request: RayTargets): RayTargets => {
        validate();
        const result = row.result === 'copy' ? { ...request } : request;
        if (row.requires === 'population.wildlife' && population?.wildlife === null) return result;
        for (const source of rays) { validate(); result.hit = source.ray.call(source.owner, result.origin, result.dir, result.maxDist, result.hit); }
        return result;
      }, entered);
    }
    if (rows.aim !== undefined) {
      const row = rows.aim;
      events.answer('combat.aimTargets', list => {
        validate();
        const result = list.filter(actor => {
          const memory = 'mem' in actor ? actor.mem : null;
          return typeof memory !== 'object' || memory === null || !row.exclude.some(rule => rule.field in memory && Reflect.get(memory, rule.field) === rule.equals);
        });
        for (const source of locks) { validate(); const target = source.lock?.call(source.owner); if (target !== null && target !== undefined) result.push(target); }
        return result;
      }, entered);
    }
  });
}
