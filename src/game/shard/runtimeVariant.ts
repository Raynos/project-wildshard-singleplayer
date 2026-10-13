import { isDev } from '@wildshard/engine/core/devMode';
import { type ShardContext, type ShardPlugin, type TrustedRuntimeEntry, standaloneHybridEntry } from '../plugin/context';
import { currentPageMode } from '../grid/pageMode';
import { shardEntry } from './entryMode';
import type { Shardfile } from '@wildshard/format/shardSchema';


/** Register a reload-only runtime choice without importing the data loader or preparing trusted hooks. */
export function runtimeVariantEnabled(context: Pick<ShardContext, 'debugRow'>,
  row: Omit<Parameters<ShardContext['debugRow']>[0], 'change'>): boolean {
  let enabled = false;
  const adapters = context;
  adapters.debugRow({ ...row, change: (value) => { enabled = value === 'on'; } });
  return enabled;
}

/** Whether this page runs the grid (home or neighbour cell): a reload variant may default differently there (G180: Pine
 *  Hollow's memory trim is on by default in the grid). Read at build time, after the boot consumed the page's intent. */
export function gridPage(): boolean { return currentPageMode() === 'grid'; }

/** Unfinished systems and diagnostics run only in the page's Developer build (E451). */
export function developerToolsEnabled(): boolean { return isDev(); }

/** SF65 (G237–G241): whether this boot enters the shard as SHARDFILE (its current port state) rather than LEGACY (the
 *  original TypeScript): SHARD SELECT's choice with Developer on, else the shard's public entry (`ShardManifest.entries`). */
export function shardfileEntry(context: Pick<ShardContext, 'manifest'>): boolean { return shardEntry(context.manifest) === 'shardfile'; }

/**
 * A first-party transitional shard's standalone entry (SF73; Signal Dunes and Sky Reach): SHARDFILE admits its shardfile
 * (`source`) and its trusted runtime at `runtime/index.ts` (`index`) through `prepareHybridShard`, with a retained home
 * and no declared item icons (`stagesOwner` 'runtime' when that runtime installs every stage itself); LEGACY keeps the
 * supplied native constructor.
 */
export function firstPartyStandaloneEntry(Native: new () => ShardPlugin, name: string, source: () => Promise<{ readonly default: Shardfile }>,
  index: TrustedRuntimeEntry['load'], stagesOwner?: 'runtime'): ReturnType<typeof standaloneHybridEntry> {
  const admit = async (ctx: ShardContext): Promise<ShardPlugin> => {
    const [{ prepareHybridShard }, { default: shard }] = await Promise.all([import('../shardfile/hybrid'), source()]);
    return prepareHybridShard(shard, { firstParty: true }, {
      residencyContext: ctx, retainHomeRuntime: true, ...(stagesOwner === undefined ? {} : { stagesOwner }),
      catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
      icon: () => { throw new Error(`Transitional ${name} has no declared item icon`); },
    }, [{ slug: shard.identity.slug, entry: 'runtime/index.ts', load: index }]);
  };
  return standaloneHybridEntry(Native, admit, shardfileEntry, name);
}
