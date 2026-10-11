import type { ShardPlugin } from '@wildshard/game/shard/plugin';
import { standaloneEntry } from './runtime/standalone';
import RuntimePlugin from './runtime/index';
import HybridRuntimePlugin from './runtime/hybrid';

/** Compatibility fixture adapter delegates unchanged hooks to the declared trusted entry. */
export class DriftwoodPlugin extends RuntimePlugin {}

/** Resolve the admitted regional entry after the ordinary lazy plugin import; standalone still uses its default. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/hybrid.ts') throw new Error('Unknown trusted runtime entry');
  return HybridRuntimePlugin;
}

const DriftwoodHybrid = standaloneEntry(RuntimePlugin);

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodHybrid;
