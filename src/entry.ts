// oxlint-disable-next-line import/no-unassigned-import -- evaluated for its effect: the app identity is installed before any other module body runs (E414)
import './identity';
import { TITLE_MANIFESTS } from 'virtual:wildshard-title';
import { installTitleManifests } from '@wildshard/game/shard/titleList';
import { startPageServices } from './pageServices';
import { persistHomeScreen } from '@wildshard/engine/saves/runtime';
import { waitFor } from '@wildshard/engine/boot/waits';
import { preloadModuleFiles } from '@wildshard/engine/boot/download';
import { reserveHomeDownload, prepareHomeExtras, prepareHomeModules, prepareBootImports } from './bootDownloads';
/**
 * The page's module entry. Everything the game imports statically is evaluated in ONE task when a module graph
 * runs: three.js plus the ~150 game modules at once was a 115–157 ms long task at 4× CPU before the first boot step
 * (project/archive/2026-09-22-load-perf.md, "longest main-thread task ≤ 100 ms"). Importing three.js first, in its own task, leaves
 * the game's own graph (src/main.ts) to evaluate against a three that already ran — two tasks under the line. The
 * title shell is already painted from index.html, so nothing waits on this but the boot itself.
 *
 * Both imports can fail before the error modal is armed (main.ts arms it): a chunk the host no longer serves, a network
 * gone mid-boot. src/engine/boot/stuck.ts watches the promise so that never leaves a frozen loader (E144).
 *
 * E188: a network gone mid-boot is the common one. main is ~1.1 MB gzipped, and on LTE a hand-over drops it mid-file;
 * WebKit reports that as "Importing a module script failed". The callback is tried twice more, a beat apart, but
 * iOS26.5 keeps a failed module URL errored (L7 Simulator proof): SW network retries must finish the body before
 * WebKit sees it. A module that fetched fine but threw is not run twice: the engine keeps it errored and rethrows at once.
 */
import { guardBoot } from '@wildshard/engine/boot/stuck';
import { inspectPreviousBoot, previousBootLine, previousBootLevel } from '@wildshard/engine/boot/bootTrace';
import { Scope } from '@wildshard/engine/app/scope';
import { retried } from './engine/boot/retry';
import { bootRoute } from './bootRoute';
import { lastEnd } from './engine/boot/lastEnd';

const entryScope = new Scope('entry');
const task = (): Promise<void> => new Promise((resolve) => { entryScope.timeout(0, resolve); });
/** The plain home URL paints only the title. No renderer, world, or Three.js is imported until a shard is chosen. */
startPageServices();
installTitleManifests(TITLE_MANIFESTS);
persistHomeScreen();
const search = new URLSearchParams(location.search);
// Do not depend on the sibling sw.ts module finishing first; both entry points share the same consumed record.
inspectPreviousBoot();
// Safari may reload the same document after WebContent dies. Keep that automatic retry on the
// renderer-free title until the player chooses a shard again.
async function enterPage(): Promise<unknown> {
  const { consumeGridRecovery, gridRecoveryRefused } = await retried(() => import('@wildshard/game/grid/pageEntry'));
  const end = lastEnd();
  const recovery = consumeGridRecovery({ unexpected: end.kind === 'unexpected', previous: end, search });
  if (recovery !== null) {
    search.set('chunk', recovery.slug); search.set('glreload', '1'); search.delete('at');
    const url = new URL(location.pathname, location.origin); url.search = search.toString();
    history.replaceState(history.state, '', url);
  }
  const route = recovery !== null ? { rescue: false, titleOnly: false } : gridRecoveryRefused() ? { rescue: true, titleOnly: true } : bootRoute(search, { line: previousBootLine(), level: previousBootLevel() });
  const rescueBoot = route.rescue;
  const titleOnly = route.titleOnly;
  if (rescueBoot) {
    history.replaceState(history.state, '', new URL('/', location.origin));
  }
  if (titleOnly) {
    // Environment harness flags do not select a level; retire the first-paint loader too.
    document.documentElement.classList.add('title-first');
    document.querySelector<HTMLElement>('.ws-resume')?.classList.remove('show');
  }

  /** resolves once the title or the selected shard's entry has been evaluated */
  return (gridRecoveryRefused() || (titleOnly && document.getElementById('ws-shardfile') === null)) ? showPageTitle() : (async () => {
    const { initializeTier } = await retried(() => import('./engine/core/tier'));
    await initializeTier();
    await retried(() => import('three')); 
    await task();
    return retried(() => import('./main'));
  })();
}
async function showPageTitle(): Promise<void> {
  const [{ showStartTitle }, { buildTitleMenu, installGridTitle }, { travel }] = await retried(() => Promise.all([import('./engine/ui/StartTitle'), import('./game/mainMenu'), import('./game/travel/travel')]));
  // SF21a: a tap or validated recovery selects a grid; unrecorded process loss returns to title
  const grid = installGridTitle();
  // the composition root wires the game's main menu (over its shard deck) into the engine's title (E405)
  showStartTitle(({ settings, notice }) => {
    const lines = [notice ?? '', grid.note].filter((line) => line !== '').join('\n');
    return buildTitleMenu({
      active: null,
      onEnter: (card) => { travel({ to: card.slug, mode: 'enter' }); },
      onExplore: (card) => { travel({ to: card.slug, mode: 'explore' }); },
      onGrid: grid.onGrid,
      ...(grid.screen === undefined ? {} : { screen: grid.screen }),
      // Settings' level-specific debug predicates initialize only after this tap.
      onSettings: () => { void retried(() => import('./shardList')).then(settings); },
      ...(lines === '' ? {} : { notice: lines }),
    });
  });
}

export const entered: Promise<unknown> = enterPage();
guardBoot(entered);

/** Composition root: select authored content and inject reusable kit recipes. */
export async function start(): Promise<void> {
  try { await startSelected(); }
  catch (error) {
    const { pageGridRecovery, clearGridRecovery } = await import('@wildshard/game/grid/pageEntry');
    if (pageGridRecovery() === null) {
      // Admission can refuse before startSession installs its fatal-load boundary. main starts asynchronously;
      // paint the same fatal card here instead of leaving a rejected boot behind the first-paint loader.
      const { showError } = await import('@wildshard/engine/ui/ErrorModal');
      showError(error instanceof Error ? `${error.name}: ${error.message}` : String(error), error instanceof Error ? error.stack ?? '' : '');
      return;
    }
    clearGridRecovery();
    history.replaceState(history.state, '', new URL('/', location.origin));
    document.documentElement.classList.add('title-first');
    document.querySelector<HTMLElement>('.ws-resume')?.classList.remove('show');
    await showPageTitle();
  }
}

async function startSelected(): Promise<void> {
  const selected = retried(() => import('./shardSelection')).then(async selection => {
    await selection.prepareSelectedShard();
    return selection;
  });
  const [{ completePageCatalogue }, { game }, { beginLoading }, { TIER }] = await Promise.all([
    selected, retried(() => import('./game/shard/registry')), retried(() => import('@wildshard/engine/ui/Loading')),
    retried(() => import('@wildshard/engine/core/tier')),
  ]);
  const loading = beginLoading({ id: game.shard.slug, name: game.shard.name, trace: game.shard.boot?.phone?.trace === true });
  const moduleText = document.getElementById('boot-module-files')?.textContent;
  const moduleRows: unknown = moduleText === undefined ? undefined : JSON.parse(moduleText);
  const modules = (kind: 'common' | 'client' | 'grid'): void => {
    if (moduleRows === undefined) return; // Source/dev documents have no emitted chunk inventory.
    if (typeof moduleRows !== 'object' || moduleRows === null || !Object.hasOwn(moduleRows, kind)) throw new Error('Missing boot module rows');
    preloadModuleFiles(Reflect.get(moduleRows, kind));
  };
  loading.waiting('Preparing application services');
  // Cover the full-ALL route's five observed misses; never recycle growables.
  const { prepareScriptMemoryBank } = await retried(() => import('./engine/script/moduleV2'));
  await prepareScriptMemoryBank([35, 0, 1, 0], task, [{ initial: 1, maximum: 2, count: 5 }, { initial: 1, maximum: 64, count: 4 }]);
  // Start every original import together; only admission's prerequisites block
  // its preparation. The full import barrier still precedes publication.
  const [speciesModule, iconsModule, pickupsModule, pickupRowsModule, propsModule, starterModule, hoverboardModule,
    voicesModule, combatModule, boarModule, familiesModule, sourceModule, runtimeModule, gridEntryModule,
    pathsModule, entryModule, calibrationModule, prefetchModule] = [
    retried(() => import('./game/systems/species/install')), retried(() => import('./game/icons')),
    retried(() => import('./game/models/specimenCatalogue')), retried(() => import('./game/data/pickupCatalogue.json')),
    retried(() => import('./game/models/interact')), retried(() => import('./game/bag/starter.generated')),
    retried(() => import('./game/systems/tools/hoverboard')), retried(() => import('@wildshard/sdk/runtime/audio/weaponVoices')), retried(() => import('@wildshard/sdk/runtime/audio/combatCues')),
    retried(() => import('@wildshard/game/systems/species/view/boar')), retried(() => import('@wildshard/game/plugin/weaponFamily')),
    retried(() => import('@wildshard/game/shardfile/clientSource')), retried(() => import('@wildshard/game/shardfile/runtimeProduct')),
    retried(() => import('@wildshard/game/grid/pageEntry')), retried(() => import('./game/boot/loadingPaths')),
    retried(() => import('./game/shard/entryMode')), retried(() => import('./loadingCalibration.json')),
    retried(() => import('./game/grid/prefetch')),
  ] as const;
  const imports = prepareBootImports(Promise.all([speciesModule, iconsModule, pickupsModule, pickupRowsModule, propsModule,
    starterModule, hoverboardModule, voicesModule, combatModule, boarModule, familiesModule, sourceModule, runtimeModule,
    gridEntryModule, pathsModule, entryModule, calibrationModule, prefetchModule]));
  const [{ sharedWeaponVoices, declaredWeaponVoices }, { BOAR_LOOK }, { declaredKitItemFamilies },
    { configuredShardfile, installShardfileProduct, installManifestShardfile, preparePageResidency }, { browserShardfileOptions },
    { pageGridRecovery }, { loadingPath }, { shardEntry }, { default: calibration }, { gridPrefetchStatus }] = await Promise.all([
    voicesModule, boarModule, familiesModule, sourceModule, runtimeModule, gridEntryModule, pathsModule, entryModule,
    calibrationModule, prefetchModule,
  ]).catch(imports.refuse);
  let page: ReturnType<typeof preparePageResidency> | undefined;
  try {
    imports.check();
    loading.setPrefetchSource(gridPrefetchStatus);
    const source = pageGridRecovery() === null ? await configuredShardfile(document, browserShardfileOptions(document.baseURI)) : null;
    page = preparePageResidency(game.shard, source?.identity.slug);
    await completePageCatalogue(page.mode);
    const path = page.mode === 'grid' ? 'grid' : source !== null || shardEntry(game.shard) === 'shardfile' ? 'shardfile' : 'legacy';
    // Publish every selected bank together before reading the descriptor.
    if (source === null) reserveHomeDownload(typeof moduleRows === 'object' && moduleRows !== null && 'products' in moduleRows ? moduleRows.products : undefined, game.shard.shardfile, document.baseURI, TIER);
    const extras = source === null && path === 'shardfile' ? prepareHomeExtras(
      typeof moduleRows === 'object' && moduleRows !== null && 'extras' in moduleRows ? moduleRows.extras : undefined,
      game.shard.shardfile, document.baseURI, entryScope) : null;
    if (source === null && path === 'shardfile') prepareHomeModules(game.shard.shardfile, document.baseURI);
    modules('common');
    if (path === 'shardfile') modules('client');
    if (path === 'grid') modules('grid');
    if (extras !== null) { loading.waiting('Reading selected download inventory'); await waitFor('Read selected download inventory', extras.read(), 'file'); }
    // Hybrid shardfile entries retain real TypeScript stages until their page is data-only.
    loading.setPath(loadingPath(path, game.shard.boot?.steps, path === 'shardfile' && source === null && game.shard.shardfile === undefined), calibration);
    const declaredIcons = ['lock', 'check', 'poi', 'you', 'map', 'pack', 'star', 'book', 'heart', 'pin', 'laurel', 'sword', 'glyph', 'coin', 'purse', 'crossbow', 'rifle', 'lever', 'longbow', 'grapple', 'horse'] as const;
    const bindings: Parameters<typeof installShardfileProduct>[2] = {
      instance: page.instance ?? (source === null ? 'template-solo' : `standalone-${source.identity.slug}`), catalogue: [], items: declaredKitItemFamilies(), voices: declaredWeaponVoices,
      ...(page.residency === undefined ? {} : { residency: page.residency }),
      icon: (name) => { const id = declaredIcons.find((entry) => entry === name); if (id === undefined) throw new Error(`Unknown catalogue item icon ${name}`); return id; },
      recipes: new Map([['kit.look.boar', (row, species) => { if (row.animation.recipe !== 'kit.pose.quadruped') throw new Error('Unknown boar pose recipe'); return { ...BOAR_LOOK, id: row.id, species: species.id, kind: species.kind }; }]]),
    };
    imports.check();
    const manifest = source === null
      ? await installManifestShardfile(game.shard, { ...browserShardfileOptions(document.baseURI, true), memory: page.memory, progress: (progress) => { loading.paintAdmission(progress); } }, bindings, imports.ready)
      : await installShardfileProduct(source, { ...browserShardfileOptions(document.baseURI), memory: page.memory, progress: (progress) => { loading.paintAdmission(progress); } }, bindings, imports.ready);
    const [{ installKitSpecies, installLegacyKitSpecies }, { installKitIcons, BAG_ICONS }, { installPickupCatalogue, preparePickupCatalogue },
      { default: PICKUP_CATALOGUE }, { installKitProps }, { STARTER_BAG_ITEMS }, { HOVERBOARD_TOOL }, , { sharedCombatCues }] = await imports.ready();
    if (source !== null || manifest.shardfile !== undefined) document.documentElement.classList.remove('title-first');
    if (manifest.legacy === true) await installLegacyKitSpecies();
    else installKitSpecies();
    installKitIcons();
    const [{boundedResponse,browserContentHash},{publicBytes}] = await Promise.all([retried(()=>import('./game/shardfile/product')),retried(()=>import('./engine/boot/tables'))]);
    const pickupAssets=publicBytes(), pickupPath=/^\/assets\/baked\/common\/pickups\/([a-f0-9]{64})\.bin$/u;
    const pickupFiles=await preparePickupCatalogue({hasFile:file=>pickupPath.test(file)&&Object.hasOwn(pickupAssets,file),file:async file=>{
      const hash=pickupPath.exec(file)?.[1],cap=pickupAssets[file];
      if(hash===undefined||cap===undefined)throw new Error('Missing pickup asset declaration');
      const bytes=await boundedResponse(await fetch(file),cap);
      if(await browserContentHash(bytes)!==hash)throw new Error('Pickup asset hash differs');
      return bytes;
    }},PICKUP_CATALOGUE,entryScope);
    installPickupCatalogue(PICKUP_CATALOGUE,pickupFiles);
    installKitProps();
    const { startSession } = await retried(() => import('./game/session/session'));
    await startSession(manifest, {
      items: STARTER_BAG_ITEMS,
      tools: [HOVERBOARD_TOOL],
      combatCues: (audio, silent) => sharedCombatCues(sharedWeaponVoices(audio), silent),
      bagIcons: BAG_ICONS,
    }, { mode: page.mode, memory: page.memory, ...(page.recovery === undefined ? {} : { recovery: page.recovery }), ...(page.residency === undefined ? {} : { residency: page.residency }) });
  } catch (error) {
    try { return await imports.refuse(error); }
    finally { page?.residency?.dispose(); page?.memory.dispose(); }
  }
}
