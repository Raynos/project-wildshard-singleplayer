import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import type { ShardContext } from '@wildshard/game/shard/context';
import { wildEnv, type WildEnv } from '../creatures/env';

type Bindings = Pick<WildEnv, 'grassHeightAt' | 'grassStandingAt' | 'trample' | 'wetAt' | 'onEvent' | 'onKnockdown'>;

/** Publish the retained creature environment only in the home cell and restore every borrowed descriptor on leave. */
export function bindEnteredEnvironment(ctx: ShardContext, bindings: Bindings): void {
  if (!retainsRuntimeServices(ctx)) throw new Error('Retained creature environment requires entered services');
  let state: WildEnv = { ...wildEnv, ...bindings, wind: { ...wildEnv.wind } };
  installEnteredRuntimeService(ctx, (scope) => {
    const previous = Object.getOwnPropertyDescriptors(wildEnv);
    Object.assign(wildEnv, state);
    scope.onDispose(() => {
      if (wildEnv.onEvent !== bindings.onEvent) return;
      state = { ...wildEnv, wind: { ...wildEnv.wind } };
      for (const key of Reflect.ownKeys(wildEnv)) if (!Object.hasOwn(previous, key)) Reflect.deleteProperty(wildEnv, key);
      Object.defineProperties(wildEnv, previous);
    });
  });
}
