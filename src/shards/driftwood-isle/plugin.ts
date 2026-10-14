import { standaloneHybridEntry, type ShardPlugin } from '@wildshard/game/plugin/context';
import { shardfileEntry, prepareStandaloneHybrid } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';
import HybridRuntimePlugin from './runtime/hybrid';

/** Compatibility fixture adapter delegates unchanged hooks to the declared trusted entry. */
export class DriftwoodPlugin extends RuntimePlugin {}

/** Resolve the admitted regional entry after the ordinary lazy plugin import; standalone still uses its default. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/hybrid.ts') throw new Error('Unknown trusted runtime entry');
  return HybridRuntimePlugin;
}

const DriftwoodHybrid = standaloneHybridEntry(RuntimePlugin,ctx=>prepareStandaloneHybrid(ctx,{name:'Driftwood',
  source:()=>import('./shard.config'),runtime:{entry:'runtime/hybrid.ts',load:()=>import('./runtime/hybrid')}}),shardfileEntry,'Driftwood');

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodHybrid;
