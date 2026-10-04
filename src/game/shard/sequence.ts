import type { Scope } from '@wildshard/engine/app/scope';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { LevelDriver } from '@wildshard/engine/level/load';

export type LevelBoundary = 'world' | 'kit' | 'loadout' | 'play' | 'finish';
export type LevelSequence<T> = AsyncGenerator<LevelBoundary, T, LevelContext | undefined>;

/** Pause an existing boot's closures at each awaited plugin hook. */
export function levelSequenceDriver<T>(sequence: LevelSequence<T>, scope: Scope, progress: () => LevelContext['progress'],
  dispose: () => void): { driver: LevelDriver; result: () => T } {
  let completed: [] | [T] = [];
  const advance = async (ctx: LevelContext, boundary: LevelBoundary): Promise<void> => {
    const next = await sequence.next(ctx);
    if (next.done || next.value !== boundary) throw new Error(`Level boot expected the ${boundary} boundary`);
  };
  return {
    driver: {
      scope: () => scope, progress,
      data: (_spec, ctx) => advance(ctx, 'world'),
      world: (_spec, ctx) => advance(ctx, 'kit'),
      kit: (_spec, ctx) => advance(ctx, 'loadout'),
      loadout: (_spec, ctx) => advance(ctx, 'play'),
      play: (_spec, ctx) => advance(ctx, 'finish'),
      finish: async (_spec, ctx) => {
        const next = await sequence.next(ctx);
        if (!next.done) throw new Error('Level boot did not finish after the play hook');
        completed = [next.value];
      },
      dispose,
    },
    result: () => {
      if (completed.length === 0) throw new Error('Level boot has not finished');
      return completed[0];
    },
  };
}
