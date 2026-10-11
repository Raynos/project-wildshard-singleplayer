import type { ShardContext } from '@wildshard/game/shard/context';
import { standaloneHybridEntry, type ShardPlugin } from '@wildshard/game/plugin/shardPlugin';
import { shardfileEntry } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class NalatiPlugin extends RuntimePlugin {}

/** Resolve only this module's declared regional entry after the ordinary lazy plugin admission. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return RuntimePlugin;
}

async function prepareNalatiHybrid(ctx: ShardContext): Promise<ShardPlugin> {
  const [{ prepareHybridShard }, { default: source }] = await Promise.all([
    import('@wildshard/game/shardfile/hybrid'), import('./shard.config'),
  ]);
  return prepareHybridShard(source, { firstParty: true }, {
    residencyContext: ctx,
    retainHomeRuntime: true,
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
    icon: () => { throw new Error('Transitional Nalati has no declared item icon'); },
  }, [{ slug: source.identity.slug, entry: 'runtime/index.ts', load: () => import('./runtime/index') }]);
}

/** Preserve native/admitted selection and its constructor injection through the defining standalone owner. */
const NalatiHybrid = standaloneHybridEntry(RuntimePlugin, prepareNalatiHybrid, shardfileEntry, 'Nalati');

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiHybrid;
