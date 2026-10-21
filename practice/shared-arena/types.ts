import type { PracticeNativeSelection } from '../../src/game/practice/PracticeNativeActor';
import type { ShardProduct } from '../../src/game/shardfile/shardProduct';
import type { readPracticePresentation } from '../../src/practicePresentation';

export interface ArenaProduct {
  readonly id: string;
  readonly label: string;
  readonly product: ShardProduct;
  /** Exact admitted kind:variant only; absence retains the published legacy owner. */
  readonly nativePractice?: Readonly<Record<string, PracticeNativeSelection>>;
  readonly presentation: ReturnType<typeof readPracticePresentation>;
}
