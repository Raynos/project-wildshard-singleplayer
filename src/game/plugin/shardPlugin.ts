import type { ShardContext } from './context';

/** Staged trusted plugin hooks; invoked only by the owning session. */
export abstract class ShardPlugin {
  world?(ctx: ShardContext): Promise<void> | void;
  kit?(ctx: ShardContext): Promise<void> | void;
  play?(ctx: ShardContext): Promise<void> | void;
}
