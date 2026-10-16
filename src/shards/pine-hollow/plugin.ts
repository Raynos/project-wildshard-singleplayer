import { standaloneHybridEntry, type ShardContext } from '@wildshard/game/plugin/context';
import type { ShardPlugin } from '@wildshard/game/shard/plugin';
import { shardfileEntry, prepareStandaloneHybrid } from '@wildshard/game/shard/runtimeVariant';
import type { prepareHybridShard as prepareTrustedHybrid } from '@wildshard/game/shardfile/hybrid';
import RuntimePlugin from './runtime/index';
import { pineMemoryTrim } from './runtime/debug/options';
import { bindPineViewTrim } from './world/terrain';

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class PineHollow extends RuntimePlugin {}

/** Resolve only this module's declared trusted entry after ordinary lazy plugin admission. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return RuntimePlugin;
}

/** Admit the retained ON home; fixtures can inject the same trusted preparation contract. */
export function preparePineHybrid(ctx: ShardContext,
  prepare?: typeof prepareTrustedHybrid): Promise<ShardPlugin> {
  return prepareStandaloneHybrid(ctx,{name:'Pine',source:()=>import('./shard.config'),
    retainHomeRuntime:true,runtime:{entry:'runtime/index.ts',load:()=>import('./runtime/index')}},prepare);
}

/** SF65 (G237–G239): SHARD SELECT's SHARDFILE admits the declared data (SF47 hybrid); LEGACY (the public entry) runs the
 *  original context and staged runtime. */
const PineEntry=standaloneHybridEntry(RuntimePlugin,preparePineHybrid,shardfileEntry,'Pine');
class PineHybrid extends PineEntry {
  constructor(...ports:ConstructorParameters<typeof PineEntry>) {
    super(...ports);bindPineViewTrim(pineMemoryTrim);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHybrid;
