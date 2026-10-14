import { firstPartyStandaloneEntry } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';

// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default firstPartyStandaloneEntry(RuntimePlugin, 'Sky Reach', () => import('./runtime/source'), () => import('./runtime/index'), 'runtime');

/** Resolve only the declared first-party entry, preserving the standalone constructor. */
export function resolveTrustedRuntime(entry: string): typeof RuntimePlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return RuntimePlugin;
}
