import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeUpdate, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';

/** Keep resident landmark animation on the entered clock; ordinary loads use their original page callback. */
export function installPineLandmarkUpdate(context: ShardContext, game: { onUpdate: (update: (dt: number, time: number) => void, label?: string) => void },
  update: (dt: number, time: number) => void): void {
  if (!retainsRuntimeServices(context)) { game.onUpdate(update, 'pine.landmarks'); return; }
  installEnteredRuntimeUpdate(context, { id: 'pine.landmarks', phase: 'update', run: update });
}
