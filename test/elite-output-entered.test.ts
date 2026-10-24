// @vitest-environment node
import * as reach from '../src/engine/ai/reach';
import type { PageWildlife } from '../src/game/population/wildlife';
import type { PatrolEncounterView } from '../src/game/boss/encounterView';
import type { ReturnProgram } from '../src/game/population/returnProgram';
import { parseSpawnScript,type SpawnScriptRows } from '../src/format/spawnScripts';
import { beforeAll,afterAll,beforeEach, expect, test, vi } from 'vitest';
import { Window } from 'happy-dom';
import { Group, PerspectiveCamera, Scene, Vector3, SkinnedMesh, MeshLambertMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { createSimHost } from '../src/engine/sim';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { loadRapier } from '../src/engine/physics/rapier';
import { fixtureBytes } from './fixtures/nativeBytes';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { withOwner } from '../src/engine/app/ownership';
import { app } from '../src/engine/app/runtime';
import { StrikeRunner } from '../src/engine/ai/strikes';
import type { StrikeData } from '../src/engine/ai/strikeRows';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { PlayerHealth } from '../src/engine/combat/health';
import { EliteBar } from '../src/engine/ui/EliteBar';
import { installEngineStrings } from '../src/engine/strings';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { ENGINE_CONTENT_STRINGS } from '../src/game/engineStrings';
import { Elites, type EliteOutputController, type ElitePageOutputLoans, type EliteEnteredOwners } from '../src/game/Elite';
import { BorrowedElite, type BorrowedEliteFight } from '../src/engine/ai/view/eliteEntry';
import { NativeEliteController } from '../src/engine/ai/view/eliteController';
import { PageWildEnvironment } from '../src/game/population/pageGroups';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import { parseEliteOutputActions, parseEliteOutputBank, type EliteOutputAction } from '../src/format/eliteFeature';
import pouncer from '../src/shards/nalati-grasslands/data/aqbarsProfile.json' with { type: 'json' };
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { mockCanvas } from './fake/weaponParity';

import { SpawnScript } from '../src/game/population/spawnScript';
import { compileScript } from '../src/sdk/bake/compileScript';
import { compileSimV2 } from './fixtures/compileSimV2';
import { layoutV2 } from '../src/format/scriptWireV2';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { sha256 } from '../src/game/plugin/moduleHash';

// Keep Node's Response/fetch for AssemblyScript's real Wasm compiler. Only
// the original widget/canvas surface is lent by this DOM fixture.
const dom = new Window();
beforeAll(async () => {
  // AssemblyScript chooses its global object once at compiler initialization.
  // Compile in actual Node BEFORE lending the window used by these widgets.
  await mixedRows(0);
  await callerRows();
  vi.stubGlobal('window',dom);vi.stubGlobal('document',dom.document);
  vi.stubGlobal('HTMLElement',dom.HTMLElement);vi.stubGlobal('HTMLCanvasElement',dom.HTMLCanvasElement);
  vi.stubGlobal('ResizeObserver',dom.ResizeObserver);vi.stubGlobal('MutationObserver',dom.MutationObserver);
});
afterAll(async () => { vi.unstubAllGlobals();await dom.happyDOM.close(); });

beforeEach(() => { installEngineStrings(ENGINE_CONTENT_STRINGS); setTerrainHeight(() => 0); mockCanvas(); });

function fixture() {
  const root = new Scope('output.fixture'), construction = root.child('construction'), entered = root.child('entered');
  const trace: unknown[][] = [], scene = new Scene(), camera = new PerspectiveCamera();
  entered.expose(app, 'levelScope', entered); entered.expose(app, 'physics', null);
  app.registerPlayer(legacyDouble<PlayerHealth>({}), entered);
  const player = legacyDouble<Player>({ position: new Vector3(), yaw: 0 });
  const game = legacyDouble<Game>({ scene, camera, app, levelScope: construction });
  const animals = legacyDouble<AnimalManager>({ spawn: () => { throw new Error('No allocation expected'); } });
  const hud = legacyDouble<EliteEnteredOwners['hud']>({ killFeed: value => { trace.push(['feed', value]); } });
  const audio = legacyDouble<EliteEnteredOwners['audio']>({ animal: (cue, at) => { trace.push(['sound', cue, at.x, at.y, at.z]); } });
  const music = legacyDouble<EliteEnteredOwners['music']>({});
  const saved = { read: () => ({}), write: () => true };
  const persistence = legacyDouble<AdventurePersistence>({ elites: saved, kill: (kind, variant) => { trace.push(['kill', kind, variant]); }, feat: kind => { trace.push(['feat', kind]); } });
  const environment = new PageWildEnvironment();
  vi.spyOn(environment, 'onKnockdown').mockImplementation((x, z, duration) => { trace.push(['knock', x, z, duration]); });
  vi.spyOn(app.combat, 'hit').mockImplementation(request => { trace.push(['hit', request.point, request.amount]); return null; });
  const actions = parseEliteOutputActions([
    { id: 1, controller: 0, kind: 'feed', text: 'Original feed' },
    { id: 2, controller: 0, kind: 'contact', amount: 14 },
    { id: 3, controller: 0, kind: 'knockdown', duration: .8 },
    { id: 4, controller: 0, kind: 'record', actorKind: 'reed', variant: 'silver' },
    { id: 5, controller: 0, kind: 'sound', cue: 'warning' },
  ], 1);
  const def = { id: 'reed.guard', name: 'Reed Guardian', epithet: 'Marsh', lair: { x: 0, z: 0, r: 4 }, awareR: 10, engageR: 5, leashR: 20,
    rule: 'always' as const, respawnMin: 1, signature: 'LEAP', phase2: 'OPEN', drop: { skin: null, skinName: '', weapon: 'branch', blurb: '' } };
  const presentation = { [def.id]: { prompt: 'Take', toast: 'Taken', hum: false, sting: { banner: .8, phase2: 1, kill: 'chunk' as const } } };
  const strike: StrikeData = { id: 'touch', shape: { kind: 'point', radius: 100 }, range: null, damage: 14,
    windup: 0, active: 0, recover: 0, cooldown: 0, tags: [], weight: { kind: 'constant', value: 1 } };
  const created = withOwner(entered, () => {
    const bar = new EliteBar(), elites = new Elites({ scene, camera, player, condition: () => false }, bar, 'reed', saved);
    const keeper = new NativeEliteController({ def, variant: def.id, kind: 'reed-cat', pattern: 'pouncer', spec: pouncer.spec, yaw: 0, offset: [0, 0], memory: {},
      tell: [.2, .3, .4], beam: [.3, .4, .5], messages: {}, voices: {} }, { game, player, animals, lifecycle: elites, bar, ledges: [], rock: { x: 0, z: 0, top: 1 } }, new Group());
    elites.add(keeper);
    const controllers: EliteOutputController[] = [{ kind: 'keeper', owner: keeper }];
    const loans: ElitePageOutputLoans = { construction, entered, game, controllers, patrol: null, wildlife: null, animals, environment,
      player, hud, audio, persistence, contacts: new StrikeRunner(), strikes: [], fallbackStrike: strike };
    const bind = (additional: readonly EliteOutputAction[] = []): void => { elites.bindEnteredPresentation({ scope: entered, hud, audio, music, interactables: [] }, presentation, { actions: [...actions, ...additional], loans }); };
    return { keeper, elites, controllers, loans, bind, presentation };
  });
  return { root, entered, construction, trace, actions, environment, ...created };
}

function actor(x: number): Animal { return legacyDouble<Animal>({ position: new Vector3(x, 0, 0), scale: 1, yaw: 0, variant: 'silver', kind: 'reed-cat', label: 'Reed' }); }

test('actual page import and original entered owner prepare effects without publishing or retargeting a hit', () => {
  const f = fixture(), original = actor(1), replacement = actor(2);
  try {
    f.keeper.animal = original;
    f.loans.hud.killFeed = value => { f.trace.push(['feed', value]); f.keeper.animal = replacement; };
    f.bind();
    const prepared = f.elites.prepareV2Outputs(parseEliteOutputBank(f.actions, [
      { action: 1, values: [] }, { action: 2, values: [0] }, { action: 3, values: [3, 4] }, { action: 4, values: [] }, { action: 5, values: [-0, 2, 3] },
    ], 1), [original]);
    prepared.validate(); expect(f.trace).toEqual([]);
    for (const apply of prepared.operations) apply();
    expect(f.trace).toEqual([['feed', 'Original feed'], ['hit', original.position, 14], ['knock', .6, .8, .8], ['kill', 'reed', 'silver'], ['feat', 'reed'], ['sound', 'warning', -0, 2, 3]]);
    expect(f.keeper.animal).toBe(replacement);
  } finally { f.root.dispose(); }
});

test('missing/null actor suffix and foreign controller refuse the whole native bank', () => {
  const f = fixture();
  try {
    f.bind();
    const bank = parseEliteOutputBank(f.actions, [{ action: 1, values: [] }, { action: 2, values: [0] }], 1);
    expect(() => f.elites.prepareV2Outputs(bank, [null])).toThrow(/actor/);
    expect(f.trace).toEqual([]);
    f.controllers[0] = { kind: 'keeper', owner: legacyDouble<NativeEliteController>({ row: f.keeper.row, def: f.keeper.def }) };
    expect(() => f.elites.prepareV2Outputs([], [])).toThrow(/Foreign/);
    expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); }
});

test('a grid entry binds its live native frame after construction without retiring the elite output owner', async () => {
  const f = fixture(), liveFrame = f.root.child('destination.live');
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm', import.meta.url))));
  const physics = new Physics(rapier);
  try {
    f.bind();
    // Build-ahead borrows level services without switching the page motor's
    // physics. The grid sets that destination frame only on actual entry.
    liveFrame.expose(app, 'levelScope', liveFrame); app.bindPlayerServices(f.entered, liveFrame);
    liveFrame.expose(app, 'physics', physics);
    const bank = f.elites.prepareV2Outputs(parseEliteOutputBank(f.actions, [{ action: 1, values: [] }], 0), []);
    bank.validate(); bank.operations[0]?.();
    expect(f.trace).toEqual([['feed', 'Original feed']]);
  } finally { f.root.dispose(); physics.dispose(); }
});

test.each(['physics', 'player'] as const)('a prepared entered bank refuses a later %s replacement before any prefix effect', async field => {
  const f = fixture(), liveFrame = f.root.child('destination.live');
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm', import.meta.url))));
  const physics = new Physics(rapier);
  try {
    liveFrame.expose(app, 'physics', physics); f.bind();
    const bank = f.elites.prepareV2Outputs(parseEliteOutputBank(f.actions, [{ action: 1, values: [] }, { action: 4, values: [] }], 0), []);
    if (field === 'physics') liveFrame.expose(app, 'physics', null);
    else app.registerPlayer(legacyDouble<PlayerHealth>({}), f.entered);
    expect(() => bank.validate()).toThrow('Retired or replaced elite output owner');
    for (const apply of bank.operations) expect(apply).toThrow('Retired or replaced elite output owner');
    expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); physics.dispose(); }
});

test('same-object service replacement and a real sliced ancestor retirement fence prepared effects', () => {
  const f = fixture();
  try {
    f.bind(); const prepared = f.elites.prepareV2Outputs(parseEliteOutputBank(f.actions, [{ action: 1, values: [] }], 0), []);
    f.environment.onKnockdown = () => { f.trace.push(['replacement']); };
    expect(() => prepared.validate()).toThrow(/replaced/); expect(() => prepared.operations[0]?.()).toThrow(/replaced/); expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); }
  const g = fixture();
  g.bind(); const ready = g.elites.prepareV2Outputs(parseEliteOutputBank(g.actions, [{ action: 1, values: [] }], 0), []);
  const retirement = g.root.disposeSteps(); retirement.next();
  try { expect(() => ready.validate()).toThrow(/owner/); expect(g.trace).toEqual([]); }
  finally { for (const step of retirement) void step; }
});

test('method identity refusal still reads the complete ordered controller suffix before rejecting', () => {
  const f = fixture(), restore: (() => void)[] = [], reads: string[] = [];
  try {
    const borrowed = external(f, 'script');
    f.bind(); const prepared = f.elites.prepareV2Outputs([], []);
    const replacement = () => undefined;
    Object.defineProperty(f.environment, 'onKnockdown', { configurable: true, get: () => { reads.push('knock'); return replacement; } });
    const observe = (owner: object, key: string, label: string): void => {
      const descriptor = Object.getOwnPropertyDescriptor(owner, key), value: unknown = Reflect.get(owner, key);
      Object.defineProperty(owner, key, { configurable: true, get: () => { reads.push(label); return value; } });
      restore.push(() => { if (descriptor === undefined) Reflect.deleteProperty(owner, key); else Object.defineProperty(owner, key, descriptor); });
    };
    observe(f.loans.hud, 'killFeed', 'feed');
    observe(f.keeper, 'row', 'keeper.row'); observe(f.keeper, 'def', 'keeper.def');
    observe(borrowed, 'row', 'external.row'); observe(borrowed, 'def', 'external.def');
    observe(borrowed, 'adopt', 'external.adopt'); observe(borrowed, 'support', 'external.support');
    expect(() => prepared.validate()).toThrow('Retired or replaced elite output owner');
    expect(reads).toEqual(['knock', 'feed', 'keeper.row', 'keeper.def', 'external.row', 'external.def', 'external.adopt', 'external.support']);
    expect(f.trace).toEqual([]);
  } finally { for (const reset of restore.reverse()) reset(); f.root.dispose(); }
});

test('getter reentry cannot overwrite an outer method replacement snapshot', () => {
  const f = fixture();
  try {
    f.bind(); const prepared = f.elites.prepareV2Outputs([], []);
    const knock: unknown = Reflect.get(f.environment, 'onKnockdown'), feed: unknown = Reflect.get(f.loans.hud, 'killFeed');
    const replacement = () => undefined;
    let changed = true, reenter = true, nested = false;
    Object.defineProperty(f.environment, 'onKnockdown', { configurable: true, get: () => changed ? replacement : knock });
    Object.defineProperty(f.loans.hud, 'killFeed', { configurable: true, get: () => {
      if (reenter) { reenter = false; changed = false; prepared.validate(); nested = true; }
      return feed;
    } });
    expect(() => prepared.validate()).toThrow('Retired or replaced elite output owner');
    expect(nested).toBe(true); expect(() => prepared.validate()).not.toThrow();
    expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); }
});

function external(f: ReturnType<typeof fixture>, mode: 'script' | 'herd'): BorrowedElite {
  return withOwner(f.entered, () => {
    const def = { ...f.keeper.def, id: 'reed.rider' };
    const common = { def, tell: [.2, .3, .4] as [number, number, number], step: 'reed.rider', ready: 'ready', damage: 'damage', broken: 'beaten', cues: {},
      adopted: { scale: 1.1, kind: 'reed', variant: 'silver', feed: 'Joined' }, states: { display: 1, beaten: 3 } };
    const row = mode === 'script' ? { ...common, mode: 'script' as const, spawn: { source: 'rider' as const, variant: 'rider' as const, yaw: .7 } }
      : { ...common, mode: 'herd' as const, spawn: { source: 'herd' as const, kind: 'reed', variant: 'silver', yaw: .7,
        offset: [2, -3] as [number, number], mares: 3, foals: 0, stallion: false, color: [.4, .5, .6] as [number, number, number] } };
    const controller = new BorrowedElite(row, { game: f.loans.game, player: f.loans.player, elites: f.elites,
      ...(mode === 'script' ? { fight: { page: () => legacyDouble<BorrowedEliteFight>({}) } } : {}) }, legacyDouble<ReturnProgram>({}), new Group());
    f.elites.add(controller); f.controllers.push({ kind: 'external', owner: controller });
    const presentation = f.presentation[f.keeper.def.id]; if (presentation === undefined) throw new Error('Missing original presentation');
    f.presentation[def.id] = presentation;
    return controller;
  });
}

test('herd result preserves original member insertion before adoptStallion and controller adoption', () => {
  const f = fixture(), body = legacyDouble<Animal>({ position: new Vector3(10, 0, 20), herd: -1, mesh: new SkinnedMesh(undefined, new MeshLambertMaterial()) });
  try {
    const members = [legacyDouble<Animal>({ herd: 0 })];
    const herd = legacyDouble<ReturnType<PageWildlife['spawnHerd']>>({ members, adoptStallion: value => {
      expect(value).toBe(body); expect(value.herd).toBe(0); expect(members[1]).toBe(body); f.trace.push(['adoptStallion']);
    } });
    const wildlife = legacyDouble<PageWildlife>({ spawnPack: () => { throw new Error('Unexpected pack'); }, spawnHerd: (...args) => { f.trace.push(['herd', ...args]); return herd; } });
    const animals = legacyDouble<AnimalManager>({ herds: [legacyDouble<AnimalManager['herds'][number]>({ members })], spawn: (...args) => { f.trace.push(['actor', ...args]); return body; } });
    Object.assign(f.loans, { wildlife, animals });
    const controller = external(f, 'herd'); controller.spawn();
    f.loans.hud.killFeed = value => { expect(controller.animal).toBe(body); f.trace.push(['feed', value]); };
    const rows = parseEliteOutputActions([{ id: 6, controller: 1, kind: 'wildlife-herd', actorKind: 'reed', variant: 'silver', offset: [2, -3], mares: 3, foals: 0, stallion: false }], 2);
    f.bind(rows); const bank = parseEliteOutputBank([...f.actions, ...rows], [{ action: 6, values: [10, 20, .7] }, { action: 1, values: [] }], 0);
    const prepared = f.elites.prepareV2Outputs(bank, []); prepared.validate(); expect(f.trace).toEqual([]);
    for (const apply of prepared.operations) apply();
    expect(f.trace).toEqual([['herd', 12, 17, 3, 0, false], ['actor', 'reed', 10, 20, .7, 'silver'], ['adoptStallion'], ['feed', 'Original feed']]);
  } finally { f.root.dispose(); }
});

test('pack home remains exact f64 and is assigned before the original controller receives it', () => {
  const f = fixture();
  try {
    const pack = legacyDouble<ReturnType<PageWildlife['spawnPack']>>({ homeX: 0, homeZ: 0 });
    Object.assign(f.loans, { wildlife: legacyDouble<PageWildlife>({ spawnHerd: () => { throw new Error('Unexpected herd'); }, spawnPack: (x, z, variants) => { f.trace.push(['pack', x, z, ...variants]); return pack; } }) });
    f.loans.hud.killFeed = value => { expect(f.keeper.pack).toBe(pack); expect(pack.homeX).toBe(100.00000000001); expect(Object.is(pack.homeZ, -0)).toBe(true); f.trace.push(['feed', value]); };
    const rows = parseEliteOutputActions([{ id: 6, controller: 0, kind: 'wildlife-pack', variants: ['plain', 'dark'] }], 1);
    f.bind(rows);
    const prepared = f.elites.prepareV2Outputs(parseEliteOutputBank([...f.actions, ...rows], [{ action: 6, values: [2, 3, 100.00000000001, -0] }, { action: 1, values: [] }], 0), []);
    expect(f.trace).toEqual([]); for (const apply of prepared.operations) apply();
    expect(f.trace).toEqual([['pack', 2, 3, 'plain', 'dark'], ['feed', 'Original feed']]);
  } finally { f.root.dispose(); }
});

test('patrol results adopt and support immediately in emitted order, retaining the emitted dissolve actor', () => {
  const f = fixture(), original = actor(1), rider = actor(2), line = [actor(3), actor(4)];
  try {
    const controller = external(f, 'script');
    vi.spyOn(controller, 'adopt').mockImplementation(value => { controller.animal = value; f.trace.push(['adopt', value]); });
    vi.spyOn(controller, 'support').mockImplementation(values => { expect(values).toBe(line); f.trace.push(['support', ...values]); });
    const patrol = legacyDouble<PatrolEncounterView>({ spawnRider: at => { f.trace.push(['rider', at]); return rider; }, spawnLine: at => { f.trace.push(['line', at]); return line; }, dissolve: value => { f.trace.push(['dissolve', value]); } });
    Object.assign(f.loans, { patrol });
    const rows = parseEliteOutputActions([{ id: 6, controller: 1, kind: 'patrol-rider', variant: 'rider' }, { id: 7, controller: 1, kind: 'patrol-line' }, { id: 8, controller: 1, kind: 'patrol-dissolve' }], 2);
    f.bind(rows); const prepared = f.elites.prepareV2Outputs(parseEliteOutputBank(rows, [{ action: 6, values: [10, 20, .7] }, { action: 7, values: [2] }, { action: 8, values: [0] }], 1), [original]);
    expect(f.trace).toEqual([]); for (const apply of prepared.operations) apply();
    expect(f.trace.map(event => event[0])).toEqual(['rider', 'adopt', 'line', 'support', 'dissolve']);
    expect(f.trace[0]?.[1]).toEqual({ x: 10, z: 20, yaw: .7, variant: 'rider' });
    expect(f.trace[1]?.[1]).toBe(rider); expect(f.trace[2]?.[1]).toEqual({ count: 2 });
    expect(f.trace[3]?.slice(1)).toHaveLength(2);
    expect(f.trace[3]?.[1]).toBe(line[0]); expect(f.trace[3]?.[2]).toBe(line[1]); expect(f.trace[4]?.[1]).toBe(original);
  } finally { f.root.dispose(); }
});

test('contact repeats the original reach check immediately before combat delivery', () => {
  const f = fixture(), body = actor(1);
  try {
    const query = vi.spyOn(reach, 'canReach').mockReturnValueOnce(true).mockReturnValueOnce(false);
    f.bind(); const prepared = f.elites.prepareV2Outputs(parseEliteOutputBank(f.actions, [{ action: 2, values: [0] }], 1), [body]);
    for (const apply of prepared.operations) apply();
    expect(query).toHaveBeenCalledTimes(2); expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); }
});


test('action metadata is the same pinned immutable table and refuses a retired binding', () => {
  const f = fixture();
  try {
    expect(() => f.elites.v2OutputActions).toThrow(/binding/);
    const rows = parseEliteOutputActions([{ id: 6, controller: 0, kind: 'wildlife-pack', variants: ['plain', 'dark'] }], 1);
    f.bind(rows); const metadata = f.elites.v2OutputActions;
    expect(f.elites.v2OutputActions).toBe(metadata); expect(f.trace).toEqual([]);
    expect(Object.isFrozen(metadata)).toBe(true); expect(metadata.every(Object.isFrozen)).toBe(true);
    const pack = metadata.find(row => row.kind === 'wildlife-pack');
    if (pack?.kind !== 'wildlife-pack') throw new Error('Missing declared pack');
    expect(() => pack.variants.push('replacement')).toThrow();
    expect(() => Object.assign(metadata[0] ?? {}, { id: 999 })).toThrow();
    const original = f.actions.find(row => row.kind === 'feed');
    if (original?.kind !== 'feed') throw new Error('Missing original feed');
    original.text = 'Changed source';
    expect(f.elites.v2OutputActions).toBe(metadata);
    f.entered.dispose(); expect(() => f.elites.v2OutputActions).toThrow(/owner/);
  } finally { f.root.dispose(); }
});

test('native post-update drain preflights all transactions and preserves forwarded bank order', () => {
  const f = fixture();
  try {
    const controller = external(f, 'script');
    vi.spyOn(f.keeper, 'drainEffects').mockReturnValue([{ kind: 'feed', id: 'Original feed', at: new Vector3() }]);
    const bank = { validate: (): void => { f.trace.push(['validated']); }, operations: [(): void => { f.trace.push(['page-bank']); }] };
    vi.spyOn(controller, 'drainEffects').mockReturnValue([{ kind: 'page-bank', bank }]);
    f.bind(); expect(f.trace).toEqual([]);
    f.elites.drainEnteredOutputs();
    expect(f.trace).toEqual([['validated'], ['feed', 'Original feed'], ['page-bank']]);
  } finally { f.root.dispose(); }
  const g = fixture();
  try {
    const controller = external(g, 'script');
    vi.spyOn(g.keeper, 'drainEffects').mockReturnValue([{ kind: 'feed', id: 'Original feed', at: new Vector3() }]);
    vi.spyOn(controller, 'drainEffects').mockReturnValue([{ kind: 'page-bank', bank: { validate: () => { throw new Error('Invalid complete bank'); }, operations: [] } }]);
    g.bind(); expect(() => g.elites.drainEnteredOutputs()).toThrow(/complete bank/); expect(g.trace).toEqual([]);
  } finally { g.root.dispose(); }
});

test('native action ambiguity and undeclared suffix refuse before the original feed', () => {
  const f = fixture();
  try {
    vi.spyOn(f.keeper, 'drainEffects').mockReturnValue([{ kind: 'feed', id: 'Original feed', at: new Vector3() }, { kind: 'knock', x: 1, z: 0 }]);
    f.bind(parseEliteOutputActions([{ id: 6, controller: 0, kind: 'knockdown', duration: 2 }], 1));
    expect(() => f.elites.drainEnteredOutputs()).toThrow(/ambiguous/); expect(f.trace).toEqual([]);
  } finally { f.root.dispose(); }
  const g = fixture();
  try {
    vi.spyOn(g.keeper, 'drainEffects').mockReturnValue([{ kind: 'feed', id: 'Original feed', at: new Vector3() }, { kind: 'feed', id: 'Undeclared', at: new Vector3() }]);
    g.bind(); expect(() => g.elites.drainEnteredOutputs()).toThrow(/native output/); expect(g.trace).toEqual([]);
  } finally { g.root.dispose(); }
});

const mixedCapacities = [{ kind: 1,capacity: 1 },{ kind: 2,capacity: 1 },{ kind: 3,capacity: 1 },{ kind: 4,capacity: 1 },{ kind: 5,capacity: 1 },{ kind: 7,capacity: 1 },{ kind: 9,capacity: 32 },{ kind: 10,capacity: 32 },{ kind: 21,capacity: 1 },{ kind: 22,capacity: 1 }];
const mixedLayout = layoutV2(2048,1,new Map(mixedCapacities.map(row => [row.kind,row.capacity])));
let mixedCode: Promise<readonly [Uint8Array,Uint8Array]> | undefined;
async function mixedRows(mode: number) {
  mixedCode ??= Promise.all([
    compileScript(`export function ws_abi():i32{return 1;}export function ws_io():i32{return 16384;}
      export function ws_init(lo:i32,hi:i32):void{}export function ws_handle():i32{unreachable();return 0;}`,{ abi: 1 }),
    compileSimV2(`import * as ws from './sdk/as/wsV2';export function onBinding():void{
      const mode=i32(ws.parameter(0));
      ws.actorCommand(13,0,1,11,0);
      if(mode==2){ws.pageOutput(1);ws.ignite(99,1,2);}
      else{ws.ignite(3,1,2);ws.pageOutput(mode==1?999:1);}
      ws.actorCommand(13,0,mode==3?99:1,22,0);ws.pageOutput(5,1,2,3);
      if(mode==4)ws.actorCommand(12,0,1,0,0);
      ws.setState(0,ws.state(0)+1);
    }`,{ io: 2048,ioBytes: mixedLayout.bytes }),
  ]);
  const [oracle,modern] = await mixedCode;
  return parseSpawnScript({ step: 'mixed',roster: 'borrowed',seed: 1,maximum: 1,controlState: 'sidestep',bytes: btoa(String.fromCodePoint(...oracle)),
    slots: [{ id: 'first',handle: 7,authority: 'observe' },{ id: 'hole',handle: 2,authority: 'observe' }],
    species: [{ id: 'body',kind: 'reed-cat',variant: 'silver' }],sites: [{ id: 'home',slot: 'first',point: [0,0],face: 'player' }],spawns: [{ id: 'body',species: 'body',site: 'home' }],
    fields: [],flags: [],cues: ['warning'],channels: ['result'],moves: [],
    script: { id: 'mixed',abi: '1.0',side: 'sim',module: `blobs/wasm/${sha256(oracle)}.wasm`,source: 'behaviour/mixed.as',binding: { shard: true },pages: 1,onFail: 'hold',tick: 10,on: ['tick'],
      reads: [],commands: ['channel','cue'],cues: { warning: 'warning' },stateVersion: 1,state: [{ name: 'calls',type: 'i32',default: 0,scope: 'binding',min: 0,max: 100 }],params: { mode },actors: { first: 'first' },channels: { result: 'result' } },
    v2: { version: 1,artifact: { abi: 2,minor: SCRIPT_V2_REVISIONS.minor,compilerRevision: SCRIPT_V2_REVISIONS.compiler,admissionRevision: SCRIPT_V2_REVISIONS.admission,
      hash: sha256(modern),lane: 'sim',pages: 1,ioBytes: mixedLayout.bytes },bytes: btoa(String.fromCodePoint(...modern)),io: 2048,capacities: mixedCapacities,divisor: 6,fuel: 100000,initFuel: 10000,columns: [],
      effects: { elites: true,world: { targets: [{ handle: 3,identity: 'cells',kind: 'cell-field' }],operations: [24],maxCommands: 4,bounds: { coordinate: 100,velocity: 5 } } } },
  });
}
function mixedRunner(f: ReturnType<typeof fixture>,rows: SpawnScriptRows,retire = false): SpawnScript {
  f.loans.animals.animals = [];
  const runner: SpawnScript = SpawnScript.page(f.loans.animals,rows,null,{ scope: f.entered },f.elites,[{ binding: '1',target: 'cells',scope: f.entered,kind: 'cell-field',owner: {
    activate: (x,z) => { f.trace.push(['ignite',runner.channel(1),x,z]);if (retire) f.entered.dispose(); },
  } }]);
  runner.frame(f.loans.player.position,0,{});return runner;
}
function forwardMixed(controller: BorrowedElite,runner: SpawnScript): void {
  const bank = runner.drainEffects().filter(effect => effect.kind === 'page-bank');
  vi.spyOn(controller,'drainEffects').mockReturnValueOnce(bank);
}

test('real AS mixed actor/world/elite effects stay deferred until the original entered drain and interleave once', async () => {
  const f = fixture();try {
    const controller = external(f,'script');f.bind();
    const runner = mixedRunner(f,await mixedRows(0));
    for (let tick = 1; tick <= 6; tick++) runner.advanceFrame(1/60);
    expect(f.trace).toEqual([]);expect(runner.channel(1)).toBe(0);expect(runner.host.snapshot().staged[0]?.external).toHaveLength(5);
    runner.advanceFrame(1/60);expect(f.trace).toEqual([]);expect(runner.channel(1)).toBe(0);
    forwardMixed(controller,runner);f.elites.update(0,0);expect(f.trace).toEqual([]);f.elites.drainEnteredOutputs();
    expect(f.trace).toEqual([['ignite',11,1,2],['feed','Original feed'],['sound','warning',1,2,3]]);expect(runner.channel(1)).toBe(22);
    f.elites.drainEnteredOutputs();expect(f.trace).toHaveLength(3);
  } finally { f.root.dispose(); }
});

test('actual mixed world/elite/actor malformed suffixes publish no prefix, state or delivered effect', async () => {
  for (const mode of [1,2,3,4]) {
    const f = fixture();try {
      f.bind();const runner = mixedRunner(f,await mixedRows(mode));
      runner.advanceFrame(7/60);expect(f.trace).toEqual([]);expect(runner.channel(1)).toBe(0);
      expect(runner.host.state(1)).toEqual({ calls: 0 });expect(runner.host.snapshot().staged).toEqual([]);expect(runner.drainEffects()).toEqual([]);
      expect(runner.snapshot()).toContain('v2Input');
    } finally { f.root.dispose(); }
  }
});

test('a real mixed page bank saved between AS stage and native commit drains op25 exactly once after restore', async () => {
  const f = fixture();try {
    const controller = external(f,'script');f.bind();const rows = await mixedRows(0),runner = mixedRunner(f,rows);
    runner.advanceFrame(6/60);const saved = runner.snapshot();expect(f.trace).toEqual([]);
    const restored = mixedRunner(f,rows);restored.restore(saved);expect(restored.snapshot()).toBe(saved);
    restored.advanceFrame(1/60);expect(f.trace).toEqual([]);forwardMixed(controller,restored);f.elites.drainEnteredOutputs();
    expect(f.trace).toEqual([['ignite',11,1,2],['feed','Original feed'],['sound','warning',1,2,3]]);
    restored.advanceFrame(1/60);forwardMixed(controller,restored);f.elites.drainEnteredOutputs();expect(f.trace).toHaveLength(3);
  } finally { f.root.dispose(); }
});


test('retirement by an earlier mixed operation fences a later channel without re-resolving actors', async () => {
  const f = fixture();try {
    const controller = external(f,'script');f.bind();const runner = mixedRunner(f,await mixedRows(0),true);
    runner.advanceFrame(7/60);forwardMixed(controller,runner);
    expect(() => f.elites.drainEnteredOutputs()).toThrow(/Retired|owner/);
    expect(f.trace).toEqual([['ignite',11,1,2]]);expect(runner.channel(1)).toBe(11);
  } finally { f.root.dispose(); }
});


let callerCode: Promise<SpawnScriptRows> | undefined;
function callerRows(): Promise<SpawnScriptRows> {
  callerCode ??= (async () => {
    const original = await mixedRows(0);
    if (original.v2 === undefined) throw new Error('Missing caller fixture selection');
    const callerCapacities = [...mixedCapacities, { kind: 6, capacity: 2 }];
    const callerLayout = layoutV2(2048,1,new Map(callerCapacities.map(row => [row.kind,row.capacity])));
    const modern = await compileSimV2(`import * as ws from './sdk/as/wsV2';export function onBinding():void{
      assert(ws.fieldId(0)==2&&ws.fieldPresent(0)&&ws.field(0)==123);
      assert(ws.fieldId(1)==1&&ws.fieldPresent(1)&&ws.field(1)==7);
      ws.actorCommand(12,ws.self(),1,0,0);
    }`, { io: 2048, ioBytes: callerLayout.bytes });
    const { effects: _effects, ...selection } = original.v2;
    return parseSpawnScript({ ...original,
      slots: [{ id: 'main', handle: 7 }],
      sites: [{ id: 'home', slot: 'main', point: [3,4], face: 'player' }],
      fields: [{ id: 'grass', source: 'observed' }, { id: 'clock', source: 'observed' }],
      script: { ...original.script, params: {}, actors: { main: 'main' }, fields: { grass: 'grass', clock: 'clock' } },
      v2: { ...selection, capacities: callerCapacities, artifact: { ...selection.artifact, hash: sha256(modern), ioBytes: callerLayout.bytes },
        bytes: btoa(String.fromCodePoint(...modern)), self: 'main',
        columns: [{ name: 'grass', id: 1, source: { kind: 'grass', at: 'self' } }] },
    });
  })();
  return callerCode;
}

test('the production external adoption runs ABI2 on its original native body and forwards effects at the original drain', async () => {
  const rows = await callerRows(), f = fixture();
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm', import.meta.url))));
  const recipe = SIM_LEVEL.entities[0];
  if (recipe === undefined) throw new Error('Missing native body recipe');
  const host = createSimHost({ ...SIM_LEVEL, quests: [], entities: [{ ...recipe, spec: { ...recipe.spec, kind: 'reed-cat', variant: 'silver' } }] }, { rapier });
  try {
    const native = host.entities.get(recipe.id);
    if (native === undefined) throw new Error('Missing original native body');
    const motor = native.motor;
    if (motor !== null && !(motor instanceof CharacterMotor)) throw new Error('Unexpected native motor');
    const body = legacyDouble<Animal>(Object.assign(native, { motor, mesh: new SkinnedMesh() }));
    body.position.set(3,2,4); f.loans.animals.animals = [body];
    const sample = vi.spyOn(f.environment, 'grassHeightAt').mockImplementation((x,z) => x+z);
    const create = vi.spyOn(SpawnScript, 'page');
    const controller = withOwner(f.entered, () => new BorrowedElite({
      def: { ...f.keeper.def, id: 'reed.rider' }, mode: 'script', tell: [.2,.3,.4],
      step: 'rider', ready: 'ready', damage: 'damage', broken: 'beaten',
      cues: { warning: { voice: 'warning' } }, adopted: { scale: 1, kind: 'reed-cat', variant: 'silver', feed: 'Joined' },
      states: {}, spawn: { source: 'rider', variant: 'rider', yaw: 0 },
    }, { game: f.loans.game, player: f.loans.player, elites: f.elites,
      fight: { page: () => SpawnScript.page(f.loans.animals, rows, f.loans.game.app.physics, { scope: f.entered, environment: f.environment }, f.elites) } },
    legacyDouble<ReturnProgram>({ project: () => ({ count: 0 }) }), new Group()));
    f.elites.add(controller); f.controllers.push({ kind: 'external', owner: controller });
    const presentation = f.presentation[f.keeper.def.id];
    if (presentation === undefined) throw new Error('Missing entered presentation');
    f.presentation[controller.def.id] = presentation;
    f.bind(parseEliteOutputActions([{ id: 6, controller: 1, kind: 'sound', cue: 'warning' }], 2));
    controller.spawn(); controller.drainEffects(); controller.adopt(body);
    const creation = create.mock.results[0];
    if (creation?.type !== 'return') throw new Error('Missing production actor runner');
    const runner = creation.value; create.mockRestore();
    expect(runner.body('main')).toBe(body);
    const checkpoint = body.snapshot(), rng = host.rng.snapshot();
    for (let tick = 1; tick <= 6; tick++) controller.tick(1/60,123,false,false);
    expect(runner.failure).toBeNull(); expect(runner.host.snapshot().staged).toHaveLength(1);
    expect(sample.mock.calls).toEqual([[3,4]]); expect(f.trace).toEqual([]); expect(controller.drainEffects()).toEqual([]);
    controller.tick(1/60,123,false,false); expect(f.trace).toEqual([]);
    f.elites.drainEnteredOutputs(); expect(f.trace).toEqual([['sound','warning',3,2,4]]);
    expect(controller.animal).toBe(body); expect(f.loans.animals.animals).toHaveLength(1); expect(f.loans.animals.animals[0]).toBe(body);
    expect(body.snapshot()).toEqual(checkpoint); expect(host.rng.snapshot()).toEqual(rng);
    f.elites.drainEnteredOutputs(); expect(f.trace).toHaveLength(1);
    const retirement = f.root.disposeSteps(); retirement.next();
    expect(() => controller.tick(1/60,123,false,false)).toThrow(/Retired/);
    for (const step of retirement) void step;
    expect(host.rng.snapshot()).toEqual(rng);
  } finally { host.dispose(); f.root.dispose(); }
});
