import { standaloneEntry } from './runtime/standalone';
import RuntimePlugin from './runtime/index';
import type { ShardPlugin } from '@wildshard/game/shard/plugin';

// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default standaloneEntry(RuntimePlugin);

/** Resolve only the declared first-party entry, preserving the standalone constructor. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return RuntimePlugin;
}
