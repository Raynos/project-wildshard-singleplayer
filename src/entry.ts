// oxlint-disable-next-line import/no-unassigned-import -- evaluated for its effect: the app identity is installed before any other module body runs (E414)
import './identity';
import { TITLE_MANIFESTS } from '../out/.app/titleCatalogue.generated';
import { installTitleManifests } from '@wildshard/game/shard/titleList';
import { installOfflineDownload } from '@wildshard/engine/ui/offlineDownload';
import { startPageServices } from './pageServices';
import { persistHomeScreen } from '@wildshard/engine/saves/runtime';
import { waitFor } from '@wildshard/engine/boot/waits';
import { preloadModuleFiles, declareModuleFiles } from '@wildshard/engine/boot/download';
import { reserveHomeDownload, prepareHomeExtras, prepareHomeModules, declareHomeModules, prepareBootImports, homeDownloadSource, declareGridHomeDownload, declareAssetTableDownloads } from './bootDownloads';
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
 * MF3 (FOUNDATIONS): no import is retried in the page (WebKit keeps a failed module URL errored, so a retry in the same
 * document only adds 0.8 + 2.5 s before the same failure); a failed import rejects `entered`, and guardBoot reloads once.
 */
import { guardBoot } from '@wildshard/engine/boot/stuck';
import { waitForLoadingStyles } from '@wildshard/engine/boot/shell';
import { inspectPreviousBoot, previousBootLine, previousBootLevel } from '@wildshard/engine/boot/bootTrace';
import { Scope } from '@wildshard/engine/app/scope';
import { bootRoute } from './bootRoute';
import { lastEnd } from '@wildshard/engine/boot/lastEnd';

declare const __GRID_SEAM_ASSET__: Parameters<typeof declareGridHomeDownload>[2];
declare const __BOOT_TABLE_ASSETS__: Parameters<typeof declareAssetTableDownloads>[0];

const entryScope = new Scope('entry');
let selectedImages: Scope | undefined;
const task = (): Promise<void> => new Promise((resolve) => { entryScope.timeout(0, resolve); });
/** The plain home URL paints only the title. No renderer, world, or Three.js is imported until a shard is chosen. */
// RL3: the static module graph has arrived and run; index.html's 12 s self-reload stands down (only a hung module
// fetch, which never gets here, reloads by itself; anything after this is guardBoot's)
document.documentElement.dataset['booted'] = '';
startPageServices();
installTitleManifests(TITLE_MANIFESTS);
// G727 / I9: Settings' "Download everything"; the prefetch loads only when the player opens or presses it
installOfflineDownload({
  size: async owner => (await import('@wildshard/game/grid/prefetch')).remainingDownloadBytes(owner),
  start: async (owner, progress) => (await import('@wildshard/game/grid/prefetch')).downloadEverything(owner, progress),
});
persistHomeScreen();
const search = new URLSearchParams(location.search);
// Do not depend on the sibling sw.ts module finishing first; both entry points share the same consumed record.
inspectPreviousBoot();
// Safari may reload the same document after WebContent dies. Keep that automatic retry on the
// renderer-free title until the player chooses a shard again.
async function enterPage(): Promise<unknown> {
  await waitFor('Startup stylesheets', waitForLoadingStyles(entryScope), 'file');
  const { consumeGridRecovery, gridRecoveryRefused } = await import('@wildshard/game/grid/pageEntry');
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
  }

  /** resolves once the title or the selected shard's entry has been evaluated */
  return (gridRecoveryRefused() || (titleOnly && document.getElementById('ws-shardfile') === null)) ? showPageTitle() : (async () => {
    await import('./assetTables').then(module => module.prepareAssetTables());
    const { initializeTier } = await import('@wildshard/engine/core/tier');
    await initializeTier();
    await import('three'); 
    await task();
    return import('./main');
  })();
}
async function showPageTitle(): Promise<void> {
  const [{ showStartTitle }, { buildTitleMenu, installGridTitle }, { travel }] = await Promise.all([import('@wildshard/engine/ui/StartTitle'), import('@wildshard/game/mainMenu'), import('@wildshard/game/travel/travel')]);
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
      // Settings needs common inventory and level predicates, without booting a renderer.
      onSettings: () => { void (async () => { const { openTitleSettings } = await import('./titleSettings'); await openTitleSettings(settings); })(); },
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
    await showPageTitle();
  }
}

async function startSelected(): Promise<void> {
  const selected = import('./shardSelection').then(async selection => {
    await selection.prepareSelectedShard();
    return selection;
  });
  const [{ preparePageCatalogue, completePageCatalogue }, { game }, { beginLoading }, { TIER }] = await Promise.all([
    selected, import('@wildshard/game/shard/registry'), import('@wildshard/engine/ui/Loading'),
    import('@wildshard/engine/core/tier'),
  ]);
  const loading = beginLoading({ id: game.shard.slug, name: game.shard.name, trace: game.shard.boot?.phone?.trace === true });
  const moduleText = document.getElementById('boot-module-files')?.textContent;
  const moduleRows: unknown = moduleText === undefined ? undefined : JSON.parse(moduleText);
  const entryModule = import('@wildshard/game/shard/entryMode');
  const gridEntryModule = import('@wildshard/game/grid/pageEntry');
  const gridMenuModule = import('@wildshard/game/grid/menu');
  const [entrySelection, gridSelection, { gridMode, DEVSERVER }] = await Promise.all([entryModule, gridEntryModule, gridMenuModule]);
  const earlyPath = gridSelection.pageGridRecovery() !== null || gridSelection.pendingGridEntry(game.shard.slug)
    ? 'grid' : entrySelection.shardEntry(game.shard);
  // Read mandatory primary declarations while services and the yielding memory
  // bank prepare. Capture any failure now; publish only at the original barrier.
  const catalogue = earlyPath === 'grid' ? prepareBootImports(preparePageCatalogue()) : null;
  const homeDescriptor = homeDownloadSource(game.shard, earlyPath === 'grid');
  if (earlyPath === 'grid') {
    const home = gridSelection.pageGridRecovery()?.instance ?? gridSelection.gridHome().instance;
    declareGridHomeDownload(gridMode(DEVSERVER), home, __GRID_SEAM_ASSET__);
  }
  declareAssetTableDownloads(__BOOT_TABLE_ASSETS__, earlyPath === 'grid' || TIER !== 'phone' ? undefined : game.shard.slug);
  const declaredHome = earlyPath !== 'legacy' && document.getElementById('ws-shardfile') === null;
  // Establish all compiler-known denominators before crediting cached code.
  // These declarations start no transport; existing preload/read barriers stay.
  const homeExtras = declaredHome && earlyPath === 'shardfile' ? prepareHomeExtras(
    typeof moduleRows === 'object' && moduleRows !== null && 'extras' in moduleRows ? moduleRows.extras : undefined,
    game.shard.shardfile, document.baseURI, entryScope) : null;
  if (declaredHome) {
    reserveHomeDownload(typeof moduleRows === 'object' && moduleRows !== null && 'products' in moduleRows ? moduleRows.products : undefined,
      homeDescriptor, document.baseURI, TIER);
    declareHomeModules(homeDescriptor, document.baseURI);
  }
  if (typeof moduleRows === 'object' && moduleRows !== null) {
    if ('common' in moduleRows) declareModuleFiles(moduleRows.common);
    const kind = earlyPath === 'grid' ? 'grid' : earlyPath === 'shardfile' ? 'client' : 'common';
    if (Object.hasOwn(moduleRows, kind)) declareModuleFiles(Reflect.get(moduleRows, kind));
  }
  const modules = (kind: 'common' | 'client' | 'grid'): void => {
    if (moduleRows === undefined) return; // Source/dev documents have no emitted chunk inventory.
    if (typeof moduleRows !== 'object' || moduleRows === null || !Object.hasOwn(moduleRows, kind)) throw new Error('Missing boot module rows');
    preloadModuleFiles(Reflect.get(moduleRows, kind));
  };
  // This exact mandatory bank can download/compile while services prepare;
  // modulepreload never executes or publishes its modules.
  modules('common');
  loading.waiting('Preparing application services');
  // Resolve the same required code while each memory reserve yields. Imports
  // cannot publish content: the memory bank and full import barrier still
  // precede admission and installation, with their original refusal order.
  const [speciesModule, iconsModule, pickupsModule, pickupRowsModule, propsModule, starterModule, hoverboardModule,
    voicesModule, combatModule, boarModule, familiesModule, sourceModule, runtimeModule,
    pathsModule, calibrationModule, prefetchModule] = [
    import('@wildshard/game/systems/species/install'), import('@wildshard/game/icons'),
    import('@wildshard/game/models/specimenCatalogue'), import('@wildshard/game/data/pickupCatalogue'),
    import('@wildshard/game/models/interact'), import('@wildshard/game/bag/starter.generated'),
    import('@wildshard/game/systems/tools/hoverboard'), import('@wildshard/sdk/runtime/audio/weaponVoices'), import('@wildshard/sdk/runtime/audio/combatCues'),
    import('@wildshard/game/systems/species/view/boar'), import('@wildshard/game/plugin/weaponFamily'),
    import('@wildshard/game/shardfile/clientSource'), import('@wildshard/game/shardfile/runtimeProduct'),
    import('@wildshard/game/boot/loadingPaths'), import('./loadingCalibration.json'),
    import('@wildshard/game/grid/prefetch'),
  ] as const;
  const imports = prepareBootImports(Promise.all([speciesModule, iconsModule, pickupsModule, pickupRowsModule, propsModule,
    starterModule, hoverboardModule, voicesModule, combatModule, boarModule, familiesModule, sourceModule, runtimeModule,
    gridEntryModule, pathsModule, entryModule, calibrationModule, prefetchModule]));
  // Cover the full-ALL route's five observed misses; never recycle growables.
  const [{ prepareScriptMemoryBank }, { yieldTask }, { diagnosticNow }] = await Promise.all([
    import('@wildshard/engine/script/moduleV2'), import('@wildshard/engine/core/workSlice'),
    import('@wildshard/engine/core/clock'),
  ]);
  const memoryStartedAt = diagnosticNow();
  let memoryTurns = 0, memoryWaitMs = 0;
  await prepareScriptMemoryBank([35, 0, 1, 0], async () => {
    // Each native reserve gets its own task, even when the CPU budget is free.
    memoryTurns++; const at = diagnosticNow(); await yieldTask(entryScope); memoryWaitMs += diagnosticNow() - at;
    if (entryScope.disposed || entryScope.disposing) throw new Error('Entry memory preparation ended');
  }, [{ initial: 1, maximum: 2, count: 5 }, { initial: 1, maximum: 64, count: 4 }]);
  performance.measure('wildshard.prepare:boot.script-memory-bank', { start: memoryStartedAt, end: diagnosticNow(),
    detail: { memoryTurns, memoryWaitMs } });
  const [{ sharedWeaponVoices, declaredWeaponVoices }, { BOAR_LOOK }, { declaredKitItemFamilies },
    { configuredShardfile, installShardfileProduct, installManifestShardfile, preparePageResidency }, { browserShardfileOptions },
    { pageGridRecovery }, { loadingPath }, { shardEntry }, { default: calibration }, { gridPrefetchStatus }] = await Promise.all([
    voicesModule, boarModule, familiesModule, sourceModule, runtimeModule, gridEntryModule, pathsModule, entryModule,
    calibrationModule, prefetchModule,
  ]).catch(imports.refuse);
  let page: ReturnType<typeof preparePageResidency> | undefined;
  const imageOwner = entryScope.child('manifest images');
  try {
    imports.check();
    loading.setPrefetchSource(gridPrefetchStatus);
    const source = pageGridRecovery() === null ? await configuredShardfile(document, browserShardfileOptions(document.baseURI)) : null;
    page = preparePageResidency(game.shard, source?.identity.slug);
    await (await import('./assetTables')).prepareAssetPacks(page.mode === 'grid' || TIER !== 'phone' ? undefined : game.shard.slug);
    await completePageCatalogue(page.mode, catalogue?.ready);
    const path = page.mode === 'grid' ? 'grid' : source !== null || shardEntry(game.shard) === 'shardfile' ? 'shardfile' : 'legacy';
    // Publish every selected bank together before reading the descriptor.
    if (source === null) reserveHomeDownload(typeof moduleRows === 'object' && moduleRows !== null && 'products' in moduleRows ? moduleRows.products : undefined, homeDescriptor, document.baseURI, TIER);
    const extras = source === null && path === 'shardfile' ? homeExtras : null;
    if (source === null && path === 'shardfile') prepareHomeModules(game.shard.shardfile, document.baseURI);
    if (path === 'shardfile') modules('client');
    if (path === 'grid') modules('grid');
    if (extras !== null) { loading.waiting('Reading selected download inventory'); await waitFor('Read selected download inventory', extras.read(), 'file'); }
    // Hybrid shardfile entries retain real TypeScript stages until their page is data-only.
    loading.setPath(loadingPath(path, game.shard.boot?.steps, path === 'shardfile' && source === null && game.shard.shardfile === undefined), calibration);
    const declaredIcons = ['lock', 'check', 'poi', 'you', 'map', 'pack', 'star', 'book', 'heart', 'pin', 'laurel', 'sword', 'glyph', 'coin', 'purse', 'crossbow', 'rifle', 'lever', 'longbow', 'grapple', 'horse'] as const;
    const bindings: Parameters<typeof installShardfileProduct>[2] = {
      imageOwner,
      instance: page.instance ?? (source === null ? 'template-solo' : `standalone-${source.identity.slug}`), catalogue: [], items: declaredKitItemFamilies(), voices: declaredWeaponVoices,
      ...(page.residency === undefined ? {} : { residency: page.residency }),
      icon: (name) => { const id = declaredIcons.find((entry) => entry === name); if (id === undefined) throw new Error(`Unknown catalogue item icon ${name}`); return id; },
      recipes: new Map([['kit.look.boar', (row, species) => { if (row.animation.recipe !== 'kit.pose.quadruped') throw new Error('Unknown boar pose recipe'); return { ...BOAR_LOOK, id: row.id, species: species.id, kind: species.kind }; }]]),
    };
    imports.check();
    const manifest = source === null
      ? await installManifestShardfile(game.shard, { ...browserShardfileOptions(document.baseURI, true), memory: page.memory, progress: (progress) => { loading.paintAdmission(progress); } }, bindings, imports.ready)
      : await installShardfileProduct(source, { ...browserShardfileOptions(document.baseURI), memory: page.memory, progress: (progress) => { loading.paintAdmission(progress); } }, bindings, imports.ready);
    // Keep the seam out of code and descriptor admission; world construction
    // can overlap this read and retains its original full-geometry barrier.
    if (page.mode === 'grid') gridSelection.startGridEntryContent(page.instance ?? pageGridRecovery()?.instance ?? gridSelection.gridHome().instance);
    const previousImages = selectedImages;
    selectedImages = imageOwner;
    previousImages?.dispose();
    const [{ installKitSpecies, installLegacyKitSpecies }, { installKitIcons, BAG_ICONS }, { installPickupCatalogue, preparePickupCatalogue },
      { default: PICKUP_CATALOGUE }, { installKitProps }, { STARTER_BAG_ITEMS }, { HOVERBOARD_TOOL }, , { sharedCombatCues }] = await imports.ready();
    if (source !== null || manifest.shardfile !== undefined) document.documentElement.classList.remove('title-first');
    if (manifest.legacy === true) await installLegacyKitSpecies();
    else installKitSpecies();
    installKitIcons();
    const [{boundedResponse,browserContentHash},{publicBytes}] = await Promise.all([import('@wildshard/game/shardfile/product'),import('@wildshard/engine/boot/tables')]);
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
    const { startSession } = await import('@wildshard/game/session/session');
    await startSession(manifest, {
      items: STARTER_BAG_ITEMS,
      tools: [HOVERBOARD_TOOL],
      combatCues: (audio, silent) => sharedCombatCues(sharedWeaponVoices(audio), silent),
      bagIcons: BAG_ICONS,
    }, { mode: page.mode, memory: page.memory, ...(page.recovery === undefined ? {} : { recovery: page.recovery }), ...(page.residency === undefined ? {} : { residency: page.residency }) });
  } catch (error) {
    try { return await imports.refuse(error); }
    finally {
      if (selectedImages === imageOwner) selectedImages = undefined;
      imageOwner.dispose(); page?.residency?.dispose(); page?.memory.dispose();
    }
  }
}
