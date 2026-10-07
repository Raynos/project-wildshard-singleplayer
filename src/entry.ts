// oxlint-disable-next-line import/no-unassigned-import -- evaluated for its effect: the app identity is installed before any other module body runs (E414)
import './identity';
import { startPageServices } from './pageServices';
import { persistHomeScreen } from './engine/saves/runtime';
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
import { guardBoot } from './engine/boot/stuck';
import { inspectPreviousBoot, previousBootLine, previousBootLevel } from './engine/boot/bootTrace';
import { setting } from './engine/ui/Settings';
import { Scope } from './engine/app/scope';
import { retried } from './engine/boot/retry';
import { bootRoute } from './bootRoute';

const entryScope = new Scope('entry');
const task = (): Promise<void> => new Promise((resolve) => { entryScope.timeout(0, resolve); });
/** The plain home URL paints only the title. No renderer, world, or Three.js is imported until a shard is chosen. */
startPageServices();
persistHomeScreen();
const search = new URLSearchParams(location.search);
// Do not depend on the sibling sw.ts module finishing first; both entry points share the same consumed record.
inspectPreviousBoot();
// Safari may reload the same document after WebContent dies. Keep that automatic retry on the
// renderer-free title until the player chooses a shard again.
function enterPage(): Promise<unknown> {
  const route = bootRoute(search, { line: previousBootLine(), level: previousBootLevel() });
  const rescueBoot = route.rescue;
  const titleOnly = route.titleOnly;
  if (rescueBoot) {
    history.replaceState(history.state, '', new URL('/', location.origin));
    // index.html picked the loading shell from the original URL before this module ran.
    document.documentElement.classList.add('title-first');
    document.querySelector<HTMLElement>('.ws-resume')?.classList.remove('show');
  }

  /** resolves once the title or the selected shard's entry has been evaluated */
  return setting('calibrate') === 'run' ? import('./engine/calibrate/entry').then((m) => m.enterCalibration()) : titleOnly && document.getElementById('ws-shardfile') === null ? (async () => {
    await retried(() => import('./shardList')); // the shard list before the deck reads it (AG4)
    const [{ showStartTitle }, { buildTitleMenu, installGridTitle }, { travel }] = await retried(() => Promise.all([import('./engine/ui/StartTitle'), import('./game/mainMenu'), import('./game/travel/travel')]));
    // SF21a: Infinite Wildshard boots only from a one-shot tap; an iOS kill of the grid only adds a line to the title
    const grid = installGridTitle();
    // the composition root wires the game's main menu (over its shard deck) into the engine's title (E405)
    showStartTitle(({ settings, notice }) => {
      const lines = [notice ?? '', grid.note].filter((line) => line !== '').join('\n');
      return buildTitleMenu({
        active: null,
        onEnter: (card) => { travel({ to: card.slug, mode: 'enter' }); },
        onExplore: (card) => { travel({ to: card.slug, mode: 'explore' }); },
        onGrid: grid.onGrid,
        onSettings: settings, ...(lines === '' ? {} : { notice: lines }),
      });
    });
  })() : (async () => {
    const { initializeTier } = await retried(() => import('./engine/core/tier'));
    await initializeTier();
    await retried(() => import('three')); 
    await task();
    return retried(() => import('./main'));
  })();
}
export const entered: Promise<unknown> = enterPage();
guardBoot(entered);

/** Composition root: select authored content and inject reusable kit recipes. */
export async function start(): Promise<void> {
  await retried(() => import('./shardList')); // the shard list before @wildshard/game reads it (AG4)
  // each module the boot needs, by name (E434: no barrels); they load in parallel, as the indexes did
  const [{ game }, { installKitSpecies }, { installKitIcons, BAG_ICONS }, { installKitPickups }, { installKitProps }, { KIT_ITEMS }, { HOVERBOARD_TOOL },
    { sharedWeaponVoices, declaredWeaponVoices }, { sharedCombatCues }, { BOAR_LOOK }, { declaredKitItemFamilies }] = await Promise.all([
    retried(() => import('./game/shard/registry')), retried(() => import('./kit/species/install')), retried(() => import('./kit/icons')),
    retried(() => import('./kit/models/pickups')), retried(() => import('./kit/models/interact')), retried(() => import('./kit/bag/items')),
    retried(() => import('./kit/tools/hoverboard')), retried(() => import('./kit/audio/weaponVoices')), retried(() => import('./kit/audio/combatCues')),
    retried(() => import('@wildshard/kit/species/view/boar')), retried(() => import('@wildshard/kit/items/declared')),
  ]);
  const { configuredShardfile, installShardfileProduct, installManifestShardfile, browserShardfileOptions } = await retried(() => import('@wildshard/game/shardfile/loader'));
  const source = configuredShardfile(document);
  const { preparePageResidency } = await retried(() => import('@wildshard/game/grid/pageBoot'));
  const page = preparePageResidency(game.shard, source?.identity.slug);
  try {
    const declaredIcons = ['lock', 'check', 'poi', 'you', 'map', 'pack', 'star', 'book', 'heart', 'pin', 'laurel', 'sword', 'glyph', 'coin', 'purse', 'crossbow', 'rifle', 'lever', 'longbow', 'grapple', 'horse'] as const;
    const bindings: Parameters<typeof installShardfileProduct>[2] = {
      instance: page.instance ?? (source === null ? 'template-solo' : `standalone-${source.identity.slug}`), catalogue: [], items: declaredKitItemFamilies(), voices: declaredWeaponVoices,
      ...(page.residency === undefined ? {} : { residency: page.residency }),
      icon: (name) => { const id = declaredIcons.find((entry) => entry === name); if (id === undefined) throw new Error(`Unknown catalogue item icon ${name}`); return id; },
      recipes: new Map([['kit.look.boar', (row, species) => { if (row.animation.recipe !== 'kit.pose.quadruped') throw new Error('Unknown boar pose recipe'); return { ...BOAR_LOOK, id: row.id, species: species.id, kind: species.kind }; }]]),
    };
    const manifest = source === null
      ? await installManifestShardfile(game.shard, browserShardfileOptions(document.baseURI, true), bindings)
      : await installShardfileProduct(source, browserShardfileOptions(document.baseURI), bindings);
    if (source !== null || manifest.shardfile !== undefined) document.documentElement.classList.remove('title-first');
    installKitSpecies();
    installKitIcons();
    installKitPickups();
    installKitProps();
    const { startSession } = await retried(() => import('./game/session/session'));
    await startSession(manifest, {
      items: KIT_ITEMS,
      tools: [HOVERBOARD_TOOL],
      combatCues: (audio, silent) => sharedCombatCues(sharedWeaponVoices(audio), silent),
      bagIcons: BAG_ICONS,
    }, { mode: page.mode, ...(page.residency === undefined ? {} : { residency: page.residency }) });
  } catch (error) {
    page.residency?.dispose();
    throw error;
  }
}
