import type { ShardProduct } from '../../src/game/shardfile/shardProduct';
import type { readPracticePresentation } from '../../src/practicePresentation';

export interface ArenaProduct {
  readonly id: string;
  readonly label: string;
  readonly product: ShardProduct;
  readonly presentation: ReturnType<typeof readPracticePresentation>;
}
