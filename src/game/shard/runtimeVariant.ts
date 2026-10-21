import type { prepareHybridShard as PrepareHybrid } from '../shardfile/hybrid';
import { isDev } from '@wildshard/engine/core/devMode';
import type { ShardContext, ShardPlugin, TrustedRuntimeEntry } from '../plugin/context';
import { currentPageMode } from '../grid/pageMode';
import { shardEntry } from './entryMode';


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

/** Explicit first-party bundled entry, with the original home/stage
 * ownership policy. The caller supplies loaders, never a shard-name lookup. */
export interface StandaloneHybridRows {
  readonly name:string;
  readonly runtime:Pick<TrustedRuntimeEntry,'entry'|'load'>;
  readonly retainHomeRuntime?:boolean;
  readonly stagesOwner?:'declared'|'runtime';
}
/** Admit the same native/data composite used by standalone constructors. An
 * injected preparation port preserves trusted fixture/host admission checks. */
export async function prepareStandaloneHybrid(ctx:ShardContext,rows:StandaloneHybridRows,
  prepare?:typeof PrepareHybrid):Promise<ShardPlugin> {
  const {prepareHybridShard}=await import('../shardfile/hybrid');
  return (prepare??prepareHybridShard)(ctx.product,{firstParty:true},{residencyContext:ctx,
    ...(rows.retainHomeRuntime===undefined?{}:{retainHomeRuntime:rows.retainHomeRuntime}),
    ...(rows.stagesOwner===undefined?{}:{stagesOwner:rows.stagesOwner}),
    catalogue:[],items:new Map(),recipes:new Map(),voices:()=>new Map(),
    icon:()=>{throw new Error(`Transitional ${rows.name} has no declared item icon`);},
  },[{slug:ctx.product.slug,...rows.runtime}]);
}
