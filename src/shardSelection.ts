import { SHARD_LOADERS, LEGACY_CONTENT_IDENTITIES } from '../out/.app/shardSelection.generated';
import { TIER } from '@wildshard/engine/core/tier';
import { declareModuleGroups } from '@wildshard/engine/boot/download';
import { installShards } from '@wildshard/game/shard/list';
import { titleManifests,findTitleManifest } from '@wildshard/game/shard/titleList';
import { retried } from '@wildshard/engine/boot/retry';
import type { PageMode } from '@wildshard/game/grid/pageMode';
import { selectedManifests, gridManifests, type SelectedManifests } from './selectedManifests';

/** Compiler facts cover only the discovery graph this page actually loads. */
function modules(selection?:string):void {
  // Existing private bank admission parses once and publishes each exact row
  // once per accounting target, including replacement ledgers and observers.
  declareModuleGroups(['boot.common',selection===undefined?'discovery.all':`discovery:${selection}`]);
}

async function completeCatalogue():Promise<void>{
  modules();
  await retried(()=>import('./shardList'));
}

/** Phones prepare their original selected manifest, never every world's code.
 * Desktop background prefetch retains full discovery; frozen phone entries prepare
 * only their inventoried primary pair, preserving content and save namespaces. */
export async function prepareSelectedShard():Promise<void>{
  const rows=titleManifests(),named=new URLSearchParams(location.search).get('chunk');
  const selected=(named===null?undefined:findTitleManifest(named))??rows[0];
  if(selected===undefined)throw new Error('No shard manifests were generated');
  if(TIER!=='phone'){await completeCatalogue();return;}
  const prepared=await selectedManifests(selected,SHARD_LOADERS,LEGACY_CONTENT_IDENTITIES,modules);
  installShards(prepared.manifests,prepared.contentIdentities);
}

/** A grid may synchronously read every primary neighbour after consuming its
 * intent. Frozen standalone copies remain available through their own loaders. */
export function preparePageCatalogue():Promise<SelectedManifests>{
  return gridManifests(titleManifests(),SHARD_LOADERS,LEGACY_CONTENT_IDENTITIES,modules);
}

/** Only the original publication barrier installs a prepared catalogue. */
export async function completePageCatalogue(mode:PageMode, prepared:()=>Promise<SelectedManifests>=preparePageCatalogue):Promise<void>{
  if(mode==='grid'){
    const catalogue=await prepared();
    installShards(catalogue.manifests,catalogue.contentIdentities);
  }
}
