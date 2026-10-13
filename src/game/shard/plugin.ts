// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-exports; frozen imports require a distinct compatibility module.
import { ShardPlugin as OwnedShardPlugin, type ShardContext } from '../plugin/context';
import { buildYield } from '@wildshard/engine/core/workSlice';

/** Frozen entries retain the exact staged constructor; primaries use plugin/context. */
// oxlint-disable-next-line eslint/no-redeclare -- TypeScript value and instance-type namespaces intentionally share the frozen name.
export const ShardPlugin = OwnedShardPlugin;
/** Frozen context typing refers to that same constructor's instance. */
export type ShardPlugin = OwnedShardPlugin;

/**
 * End a stretch of a shard's world build (op-hitch45): `await worldBuildYield(ctx)` between pieces. A fresh timer task of
 * the shard's scope, or, in play with a frame due (the `buildPacing` Developer tool), a wait for the engine loop's next
 * drawn frame: a grid cell builds its world on the road, and WebKit draws no frame between back-to-back timer tasks.
 * Rejects once the shard's scope has closed (an unloaded cell stops building).
 */
export function worldBuildYield(ctx: Pick<ShardContext, 'scope'>): Promise<void> { return buildYield(ctx.scope); }
