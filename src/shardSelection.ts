import { SHARD_LOADERS } from 'virtual:wildshard-selection';
import { TIER } from '@wildshard/engine/core/tier';
import { declareModuleFiles } from '@wildshard/engine/boot/download';
import { installShards } from '@wildshard/game/shard/list';
import { titleManifests,findTitleManifest } from '@wildshard/game/shard/titleList';
import { retried } from '@wildshard/engine/boot/retry';
import type { PageMode } from '@wildshard/game/grid/pageMode';

/** Compiler facts cover only the discovery graph this page actually loads. */
function modules(selection?:string):void {
  const text=document.getElementById('boot-module-files')?.textContent;
  if(text===undefined)return; // Source/dev documents have no emitted inventory.
  const rows:unknown=JSON.parse(text);
  if(typeof rows!=='object'||rows===null)throw new Error('Missing discovery module inventory');
  declareModuleFiles(Reflect.get(rows,'common'));
  const bank:unknown=Reflect.get(rows,selection===undefined?'catalogue':'selection');
  if(selection===undefined){declareModuleFiles(bank);return;}
  if(typeof bank!=='object'||bank===null||!Object.hasOwn(bank,selection))throw new Error('Missing selected discovery modules');
  declareModuleFiles(Reflect.get(bank,selection));
}

async function completeCatalogue():Promise<void>{
  modules();
  await retried(()=>import('./shardList'));
}

/** Phones prepare their original selected manifest, never every world's code.
 * Desktop background prefetch and explicit legacy boots still need full discovery. */
export async function prepareSelectedShard():Promise<void>{
  const rows=titleManifests(),named=new URLSearchParams(location.search).get('chunk');
  const selected=(named===null?undefined:findTitleManifest(named))??rows[0];
  if(selected===undefined)throw new Error('No shard manifests were generated');
  if(TIER!=='phone'||selected.legacy===true){await completeCatalogue();return;}
  const load=SHARD_LOADERS[selected.slug];
  if(load===undefined)throw new Error('Missing selected discovery loader');
  modules(selected.slug);
  const manifest=await retried(load);
  if(SHARD_LOADERS[manifest.slug]!==load)throw new Error('Selected discovery identity differs');
  installShards([manifest]);
}

/** A grid may synchronously read all neighbour manifests after consuming its intent. */
export async function completePageCatalogue(mode:PageMode):Promise<void>{
  if(mode==='grid')await completeCatalogue();
}
