import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual composition-root continuation without running the browser entry.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Erase only types in the actual root, retaining its scheduling and error order.
import {stripTypeScriptTypes} from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Inject finite module/cache ports into the real world-only continuation.
import {runInNewContext} from 'node:vm';
import {prepareBootImports} from './bootDownloads';

function deferred(): {ready: Promise<void>; finish: () => void} {
  let finish = (): void => {throw new Error('Missing deferred');};
  const ready = new Promise<void>(resolve => {finish = resolve;});
  return {ready, finish};
}

function continuation(ports: Record<string, unknown>): Promise<unknown> {
  const source = readFileSync(new URL('entry.ts', import.meta.url), 'utf8');
  const start = source.indexOf('    const tables = prepareBootImports('), end = source.indexOf("    await import('three');", start);
  if (start === -1 || end < start) throw new Error('Missing early world download continuation');
  const body = source.slice(start, end).replaceAll(/\bimport\(([^)]+)\)/gu, 'load($1)');
  const result: unknown = runInNewContext(stripTypeScriptTypes(`(async () => {${body}})()`), {
    prepareBootImports, search: new URLSearchParams('chunk=example'), ...ports,
  });
  if (!(typeof result === 'object' && result !== null && 'then' in result && typeof result.then === 'function')) throw new Error('Missing root work');
  return Promise.resolve(result);
}

test.each([false, true])('world manifest starts before tables/Three and preserves actual tier and grid intent (%s)', async grid => {
  const tables = deferred(), job = deferred(), started = deferred(), calls: unknown[] = [];
  const tier = {TIER: 'desktop', initializeTier: (): Promise<void> => {tier.TIER = 'phone'; return Promise.resolve();}};
  const run = continuation({
    load: (name: string): Promise<unknown> => {
      if (name === './assetTables') return Promise.resolve({prepareAssetTables: () => tables.ready});
      if (name.endsWith('/core/tier')) return Promise.resolve(tier);
      if (name.endsWith('/grid/menu')) return Promise.resolve({DEVSERVER: false, gridMode: () => ({developer: true, devserver: false, nineDragon: false})});
      if (name.endsWith('/boot/spawnDownload')) return Promise.resolve({
        startSpawnDownload: (...args: unknown[]) => {calls.push(args); started.finish(); return job;},
        paintSpawnDownload: () => {calls.push('paint'); return () => {calls.push('stop');};},
      });
      throw new Error(`Unexpected early import: ${name}`);
    },
    pageGridRecovery: () => null, pendingGridEntry: () => grid,
    document: {querySelector: () => ({})},
  });
  await started.ready; await Promise.resolve();
  expect(calls).toEqual([['example', grid ? 'grid' : 'client', 'phone', '100'], 'paint']);
  tables.finish(); await run; expect(calls).toHaveLength(2);
  job.finish(); await job.ready; expect(calls.at(-1)).toBe('stop');
});

test('original table failure wins over concurrent tier setup failure', async () => {
  const tableError = new Error('original table failure'), tierError = new Error('later tier failure');
  await expect(continuation({load: (name: string): Promise<unknown> => {
    if (name === './assetTables') return Promise.resolve({prepareAssetTables: () => Promise.reject(tableError)});
    if (name.endsWith('/core/tier')) return Promise.resolve({initializeTier: () => Promise.reject(tierError)});
    return Promise.resolve({});
  }})).rejects.toBe(tableError);
});

/** Execute the actual selected-entry body with finite service/admission ports.
 * These gates exercise its order without constructing a browser or renderer. */
function selectedEntry(admissionFailure?: Error) {
  const source = readFileSync(new URL('entry.ts', import.meta.url), 'utf8');
  const start = source.indexOf('async function startSelected(): Promise<void> {');
  if (start === -1) throw new Error('Missing selected entry');
  const body = source.slice(start).replaceAll(/\bimport\(([^)]+)\)/gu, 'load($1)');
  const events: string[] = [], memory = deferred(), memoryStarted = deferred(), admission = deferred(), admissionStarted = deferred();
  let acceptSession = (): void => {throw new Error('Missing session import');};
  let rejectSession = (_error: Error): void => {throw new Error('Missing session import');};
  const session = new Promise<unknown>((resolve, reject) => {
    acceptSession = () => {resolve({startSession: () => {events.push('session:start'); return Promise.resolve();}});};
    rejectSession = reject;
  });
  const noop = (): void => undefined, resolved = (): Promise<void> => Promise.resolve();
  const shard = {slug: 'example', name: 'Example'}, imageOwner = {dispose: () => {events.push('images:dispose');}};
  const page = {mode: 'shardfile', memory: {dispose: () => {events.push('memory:dispose');}}};
  const kit = {installKitSpecies: () => {events.push('kit:species');},
    installKitIcons: () => {events.push('kit:icons');}, BAG_ICONS: {},
    preparePickupCatalogue: () => {events.push('kit:pickup:prepare'); return Promise.resolve([]);},
    installPickupCatalogue: () => {events.push('kit:pickup:install');},
    installKitProps: () => {events.push('kit:props');}, default: {}, STARTER_BAG_ITEMS: [], HOVERBOARD_TOOL: {},
    sharedWeaponVoices: noop, declaredWeaponVoices: noop, sharedCombatCues: noop,
    BOAR_LOOK: {}, declaredKitItemFamilies: () => []};
  const grid = {pageGridRecovery: () => null, pendingGridEntry: () => false};
  const modules: Record<string, unknown> = {
    './shardSelection': {prepareSelectedShard: resolved, completePageCatalogue: resolved},
    '@wildshard/game/shard/registry': {game: {shard}},
    '@wildshard/engine/ui/Loading': {beginLoading: () => ({waiting: noop, setPrefetchSource: noop, setPath: noop})},
    '@wildshard/engine/core/tier': {TIER: 'phone'},
    '@wildshard/game/shard/entryMode': {shardEntry: () => 'shardfile'},
    '@wildshard/game/grid/pageEntry': grid,
    '@wildshard/game/grid/menu': {DEVSERVER: false, gridMode: () => ({})},
    '@wildshard/game/boot/spawnDownload': {startSpawnDownload: () => null},
    '@wildshard/game/shardfile/clientSource': {configuredShardfile: () => Promise.resolve(null), preparePageResidency: () => page,
      installManifestShardfile: async () => {
        events.push('admission:start'); admissionStarted.finish(); await admission.ready;
        if (admissionFailure !== undefined) throw admissionFailure;
        events.push('admission:end'); return shard;
      }},
    '@wildshard/game/shardfile/runtimeProduct': {browserShardfileOptions: () => ({})},
    '@wildshard/game/boot/loadingPaths': {loadingPath: noop},
    '@wildshard/game/grid/prefetch': {gridPrefetchStatus: noop},
    '@wildshard/engine/script/moduleV2': {prepareScriptMemoryBank: async () => {
      events.push('memory:start'); memoryStarted.finish(); await memory.ready; events.push('memory:end');
    }},
    '@wildshard/engine/core/workSlice': {yieldTask: resolved},
    '@wildshard/engine/core/clock': {diagnosticNow: () => 0},
    './assetTables': {prepareAssetPacks: resolved},
    '@wildshard/game/shardfile/product': {},
    '@wildshard/engine/boot/tables': {publicBytes: () => ({})},
  };
  for (const name of ['@wildshard/game/systems/species/install', '@wildshard/game/icons',
    '@wildshard/game/models/specimenCatalogue', '@wildshard/game/data/pickupCatalogue', '@wildshard/game/models/interact',
    '@wildshard/game/bag/starter.generated', '@wildshard/game/systems/tools/hoverboard',
    '@wildshard/sdk/runtime/audio/weaponVoices', '@wildshard/sdk/runtime/audio/combatCues', '@wildshard/game/plugin/audio',
    '@wildshard/game/systems/species/view/boar', '@wildshard/game/plugin/weaponFamily']) modules[name] = kit;
  const result: unknown = runInNewContext(stripTypeScriptTypes(`${body}; startSelected();`), {
    prepareBootImports, entryScope: {child: () => imageOwner}, selectedImages: undefined, crashResume: null,
    document: {getElementById: () => null, baseURI: 'https://example.invalid/', documentElement: {classList: {remove: noop}}},
    performance: {measure: noop},
    load: (name: string): Promise<unknown> => {
      if (name === '@wildshard/game/session/session') {events.push('session:import'); return session;}
      if (!Object.hasOwn(modules, name)) throw new Error(`Unexpected selected import: ${name}`);
      return Promise.resolve(modules[name]);
    },
  });
  if (!(typeof result === 'object' && result !== null && 'then' in result && typeof result.then === 'function')) throw new Error('Missing selected work');
  return {run: Promise.resolve(result), events, memory, memoryStarted, admission, admissionStarted, acceptSession, rejectSession};
}

test('early session code waits for the original memory, admission and kit barrier before starting', async () => {
  const f = selectedEntry();
  await f.memoryStarted.ready; f.acceptSession(); await Promise.resolve();
  expect(f.events).toEqual(['session:import', 'memory:start']);
  f.memory.finish(); await f.admissionStarted.ready;
  expect(f.events).toEqual(['session:import', 'memory:start', 'memory:end', 'admission:start']);
  f.admission.finish(); await f.run;
  expect(f.events).toEqual(['session:import', 'memory:start', 'memory:end', 'admission:start', 'admission:end',
    'kit:species', 'kit:icons', 'kit:pickup:prepare', 'kit:pickup:install', 'kit:props', 'session:start']);
});

test('an admission failure still wins over an early session import failure', async () => {
  const admission = new Error('original admission failure'), session = new Error('later session failure'), f = selectedEntry(admission);
  await f.memoryStarted.ready; f.rejectSession(session); await Promise.resolve();
  const rejected = expect(f.run).rejects.toBe(admission);
  f.memory.finish(); await f.admissionStarted.ready; f.admission.finish(); await rejected;
  expect(f.events).not.toContain('session:start'); expect(f.events).not.toContain('kit:props');
  expect(f.events.slice(-2)).toEqual(['images:dispose', 'memory:dispose']);
});

test('an early session failure is raised only after the original kit barrier', async () => {
  const reason = new Error('session module failed'), f = selectedEntry();
  await f.memoryStarted.ready; f.rejectSession(reason); await Promise.resolve();
  const rejected = expect(f.run).rejects.toBe(reason);
  f.memory.finish(); await f.admissionStarted.ready; f.admission.finish(); await rejected;
  expect(f.events).toContain('kit:props'); expect(f.events).not.toContain('session:start');
  expect(f.events.slice(-2)).toEqual(['images:dispose', 'memory:dispose']);
});
