import type { Game } from '@wildshard/engine/core/Game';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';

/** Retain encounter state while its update and traveller holds belong only to the entered home. */
export function installPineCombatCallbacks(context: ShardContext | undefined, host: Pick<Game, 'app' | 'levelScope'>,
  system: Parameters<ShardContext['system']>[0], release: () => void): void {
  if (context === undefined || !retainsRuntimeServices(context)) {
    host.app.addSystem(system, host.levelScope);
    return;
  }
  installEnteredRuntimeService(context, (scope) => { host.app.addSystem(system, scope); scope.onDispose(release); });
}
