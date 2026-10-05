import type { Game } from '@wildshard/engine/core/Game';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeObserver, installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';

/** Combat debug observers belong to the entered home; borrowed browser properties are restored on leave. */
export function installPineCombatObservers(context: ShardContext, observers: { elites: object; king: object }): void {
  installEnteredRuntimeObserver(context, '__pineElites', observers.elites);
  installEnteredRuntimeObserver(context, '__antlerKing', observers.king);
}

/** Retain encounter state while its update and traveller holds belong only to the entered home. */
export function installPineCombatCallbacks(context: ShardContext | undefined, host: Pick<Game, 'app' | 'levelScope'>,
  system: Parameters<ShardContext['system']>[0], release: () => void): void {
  if (context === undefined || !retainsRuntimeServices(context)) {
    host.app.addSystem(system, host.levelScope);
    return;
  }
  installEnteredRuntimeService(context, (scope) => { host.app.addSystem(system, scope); scope.onDispose(release); });
}
