import { expect, expectTypeOf, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import type { EliteBar } from '../src/engine/ui/EliteBar';
import { EncounterRegistry } from '../src/engine/ai/encounters';
import { Elites, type EliteDeclaredEntryOwners } from '../src/game/Elite';
import { app } from '../src/engine/app/runtime';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import { ReturnProgram } from '../src/game/population/returnProgram';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import { parseExternalElite } from '../src/format/eliteFeature';
import { StrikeRunner } from '../src/engine/ai/strikes';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import type { PageWildEnvironment } from '../src/game/population/pageGroups';
import type { HUD } from '../src/engine/ui/HUD';
import type { Audio } from '../src/engine/audio/Audio';
import type { Music } from '../src/engine/audio/Music';
import { strike } from '../src/sdk/species';
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };
import { ExternalElitePage } from '../src/game/quest/elitePage';
import { prepareEliteEntry, DeclaredEliteEntry, type EliteEntryLifecycle } from '../src/engine/ai/view/eliteEntry';
import { NativeEliteController } from '../src/engine/ai/view/eliteController';
import { ELITE_BODY_COLUMNS, ELITE_CONDITION_COLUMNS } from '../src/format/eliteEntryRows';
import { ObservationColumnsV2, type V2EnvironmentColumns } from '../src/engine/script/observationColumnsV2';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { eliteThink, eliteDamageMul, setEliteBrain, setEliteDamage } from '../src/engine/entities/eliteBrain';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import pouncer from '../src/shards/nalati-grasslands/data/aqbarsProfile.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';
import { eliteEntryProbeFrame } from './fixtures/eliteEntryProbe';
import { buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';

function fixture(sharedConstruction?: Scope) {
  const root = new Scope('entry.fixture'), construction = sharedConstruction ?? root.child('construction'), entered = root.child('entered');
  const def = { id: 'reed.guardian', name: 'Reed Guardian', epithet: 'Marsh', lair: { x: 25, z: -40, r: 4 }, awareR: 30, engageR: 10, leashR: 80,
    rule: 'always' as const, respawnMin: 5, signature: 'Leap', phase2: 'Open', drop: { skin: null, skinName: '', weapon: 'branch', blurb: '' } };
  const profile = { def, kind: 'reed-cat', pattern: 'pouncer' as const, spec: pouncer.spec, yaw: .7, offset: [3, -2], memory: { low: .2 },
    tell: [.2, .7, .5], beam: [.5, .4, .8], messages: { opened: 'Open' }, voices: { growl: 'warning' } };
  const borrowed = { def: { ...def, id: 'reed.rider' }, row: { mode: 'script' as const }, observe: vi.fn<(_dt: number, _frame: { available: boolean; kills: number; bonded: boolean; mount: Animal | null }) => void>(() => undefined), despawn: vi.fn<() => void>(() => undefined), prepareEntered: vi.fn<() => void>(() => undefined) };
  const input = { version: 1, id: 'marsh.roster', ui: 'entered.ui', conditionObservations: 'condition.inputs',
    conditions: [{ id: 'always', program: 'rules', signal: 'rule', observations: [{ field: 'rule', value: 0 }] }],
    entries: [{ id: def.id, condition: 'always', controller: { kind: 'pouncer' as const, profile: 'reed.profile', body: 'animals', model: 'reed.model', observations: 'reed.inputs',
      spawn: { kind: profile.kind, variant: 'silver', yaw: profile.yaw, offset: [...profile.offset], memory: { ...profile.memory } },
      contacts: [{ amount: 14, action: 1 }, { amount: 35, action: 2 }], knock: 3, opened: 4, growl: 5 } },
    { id: borrowed.def.id, condition: 'always', controller: { kind: 'borrowed' as const, controller: 'original.rider' } }] };
  const scene = new Scene(), model = new Group(), spawn = vi.fn<AnimalManager['spawn']>(() => { throw new Error('No body allocation expected'); });
  const actors: Animal[] = [], retire = vi.fn<AnimalManager['retire']>(() => undefined), manager = legacyDouble<AnimalManager>({ spawn, retire, animals: actors });
  const entries: { script: NativeEliteController | typeof borrowed }[] = [];
  const lifecycle = { entries, signature: vi.fn<(_id: string) => void>(() => undefined), owned: vi.fn((_id: string) => false),
    add: vi.fn<(script: NativeEliteController | typeof borrowed) => void>(script => { entries.push({ script }); }),
    initialize: vi.fn<() => void>(() => undefined), update: vi.fn<(_dt: number, _t: number) => void>(() => undefined), drainEnteredOutputs: vi.fn<() => void>(() => undefined) };
  const services = { game: legacyDouble<Game>({ scene, camera: new PerspectiveCamera(), levelScope: construction }), player: legacyDouble<Player>({ position: new Vector3() }),
    lifecycle, bar: legacyDouble<EliteBar>({}), ledges: [], rock: { x: 0, z: 0, top: 3 } };
  const owners = { scope: entered, self: { group: 'marsh', slot: 0, identity: '', actor: null }, player: services.player, observed: new Map<number, Animal>(), t: 0, dt: 0, clock: { hour: 12, dayPhase: 'day' as const, night: 0 }, weather: { stormActive: false }, environment: { playerCrouched: false, playerFwdX: 0, playerFwdZ: 1, playerMounted: false, playerHealth01: 1, light: 1, storm: false, wind: { x: 0, z: 1, strength: 1 }, grassHeightAt: vi.fn(() => 0) } };
  const loans = { construction, entered, ui: { id: 'entered.ui', services }, profiles: [{ id: 'reed.profile', value: profile }], bodies: [{ id: 'animals', manager }], models: [{ id: 'reed.model', object: model }],
    observations: [{ id: 'condition.inputs', columns: new ObservationColumnsV2(ELITE_CONDITION_COLUMNS, entered), owners }, { id: 'reed.inputs', columns: new ObservationColumnsV2(ELITE_BODY_COLUMNS, entered), owners }],
    programs: [{ id: 'rules', owner: construction, program: { project: vi.fn(() => ({ accept: 1 })) } }], controllers: [{ id: 'original.rider', controller: borrowed }],
    actions: [{ id: 1, controller: 0, kind: 'contact', amount: 14 }, { id: 2, controller: 0, kind: 'contact', amount: 35 },
      { id: 3, controller: 0, kind: 'knockdown', duration: 1 }, { id: 4, controller: 0, kind: 'feed', text: 'Open' }, { id: 5, controller: 0, kind: 'sound', cue: 'warning' }] };
  return { root, construction, entered, def, profile, borrowed, input, scene, model, spawn, retire, actors, manager, lifecycle, loans };
}

test('whole-row admission has no effects; engine constructs native kernels in original order and borrows the original controller', () => {
  const f = fixture(); setTerrainHeight(() => 0);
  try {
    const plan = prepareEliteEntry(f.input, f.loans);
    expect(f.scene.children).toHaveLength(0); expect(f.spawn).not.toHaveBeenCalled(); expect(f.loans.programs[0]?.program.project).not.toHaveBeenCalled();
    const controllers = f.entered.run(plan.construct);
    expect(controllers[0]).toBeInstanceOf(NativeEliteController); expect(controllers[1]).toBe(f.borrowed);
    const native = controllers[0]; if (!(native instanceof NativeEliteController)) throw new Error('Missing native controller');
    expect(native.row.variant).toBe('silver'); expect(native.dropModel()).not.toBe(f.model);
    expect(() => f.entered.run(plan.construct)).toThrow('phase');
    expect(f.scene.children).toHaveLength(1);
    f.entered.dispose(); expect(f.scene.children).toHaveLength(0); expect(f.model.parent).toBeNull();
    expect(() => plan.validate()).toThrow('Retired');
  } finally { f.root.dispose(); }
});

test('a bad borrowed suffix, missing model or native spec refuses before tell/body/program effects', () => {
  for (const change of ['borrowed', 'model', 'spec']) {
    const f = fixture();
    try {
      if (change === 'borrowed') f.borrowed.def.id = 'foreign';
      else if (change === 'model') f.loans.models.length = 0;
      else f.profile.spec = { ...f.profile.spec, swipe: { ...f.profile.spec.swipe, first: 2 } };
      expect(() => prepareEliteEntry(f.input, f.loans)).toThrow();
      expect(f.scene.children).toHaveLength(0); expect(f.spawn).not.toHaveBeenCalled(); expect(f.loans.programs[0]?.program.project).not.toHaveBeenCalled();
    } finally { f.root.dispose(); }
  }
});

test('contact mappings must cover original native damages and be unambiguous before construction', () => {
  for (const change of ['missing', 'amount', 'duplicate']) {
    const f = fixture();
    try {
      const native = f.input.entries[0]?.controller; if (native?.kind !== 'pouncer') throw new Error('Missing native row');
      if (change === 'missing') native.contacts.pop();
      else if (change === 'amount') native.contacts[0] = { amount: 13, action: 1 };
      else f.loans.actions.push({ id: 99, controller: 0, kind: 'contact', amount: 14 });
      expect(() => prepareEliteEntry(f.input, f.loans)).toThrow(); expect(f.scene.children).toHaveLength(0);
    } finally { f.root.dispose(); }
  }
});

test('finite operands that overflow after origin addition refuse before allocation', () => {
  const f = fixture();
  try {
    f.profile.def.lair.x = Number.MAX_VALUE; f.profile.offset[0] = Number.MAX_VALUE;
    const native = f.input.entries[0]?.controller; if (native?.kind !== 'pouncer') throw new Error('Missing native row'); native.spawn.offset[0] = Number.MAX_VALUE;
    expect(() => prepareEliteEntry(f.input, f.loans)).toThrow('pose'); expect(f.scene.children).toHaveLength(0);
  } finally { f.root.dispose(); }
});

test('same-array replacement and native callable replacement invalidate a prepared construction', () => {
  for (const change of ['member', 'spawn', 'program', 'capture', 'definition']) {
    const f = fixture();
    try {
      const plan = prepareEliteEntry(f.input, f.loans);
      if (change === 'member') f.loans.models[0] = { id: 'reed.model', object: new Group() };
      else if (change === 'spawn') f.manager.spawn = () => { throw new Error('Replaced body owner'); };
      else if (change === 'program') { const loan = f.loans.programs[0]; if (loan === undefined) throw new Error('Missing program'); loan.program.project = vi.fn(() => ({ accept: 0 })); }
      else if (change === 'definition') f.borrowed.def = { ...f.borrowed.def };
      else { const loan = f.loans.observations[0]; if (loan === undefined) throw new Error('Missing observations'); loan.columns.capture = () => []; }
      expect(() => f.entered.run(plan.construct)).toThrow('Replaced'); expect(f.scene.children).toHaveLength(0);
    } finally { f.root.dispose(); }
  }
});

test('a still-open sibling entered scope cannot construct during sliced construction-ancestor retirement', () => {
  const f = fixture(); f.root.onDispose(() => undefined);
  const plan = prepareEliteEntry(f.input, f.loans), steps = f.root.disposeSteps();
  try {
    expect(steps.next().done).toBe(false);
    expect(f.entered.disposed).toBe(false); expect(f.entered.disposing).toBe(true);
    expect(() => f.entered.run(plan.construct)).toThrow('Retired'); expect(f.scene.children).toHaveLength(0);
  } finally { for (const _step of steps) { /* Drain the original retirement. */ } f.root.dispose(); }
});


test('engine spawn consumes the declared variant and f64 placement without adding body authority', () => {
  const f = fixture(), body = legacyDouble<Animal>({ mem: {}, herd: 4 });
  f.spawn.mockImplementation(() => body);
  try {
    const plan = prepareEliteEntry(f.input, f.loans), controller = f.entered.run(plan.construct)[0];
    if (!(controller instanceof NativeEliteController)) throw new Error('Missing native controller');
    controller.spawn(); controller.tick(.1, .1, true, false);
    expect(f.loans.ui.services.lifecycle.signature).not.toHaveBeenCalled();
    expect(f.spawn).toHaveBeenCalledExactlyOnceWith('reed-cat', 28, -42, .7, 'silver');
    expect(body.mem['low']).toBe(.2); expect(body.herd).toBe(-1);
    f.entered.dispose(); expect(f.retire).not.toHaveBeenCalled();
    expect(() => controller.spawn()).toThrow('Retired');
    controller.despawn(); expect(f.retire).toHaveBeenCalledTimes(1); expect(f.retire.mock.calls[0]?.[0] === body).toBe(true);
  } finally { f.root.dispose(); }
});

test('retirement clears only the original body binding and sliced retirement makes native delegates inert', () => {
  const root = new Scope('bindings.fixture'), old = root.child('old'), fresh = root.child('fresh');
  const actor = legacyDouble<Animal>({}), context = legacyDouble<ThinkCtx>({}), calls: string[] = [];
  const releaseOld = setEliteBrain(actor, () => { calls.push('old'); }, old);
  setEliteBrain(actor, () => { calls.push('fresh'); }, fresh);
  setEliteDamage(actor, () => .4, fresh);
  try {
    releaseOld(); old.dispose(); eliteThink(actor, context);
    expect(calls).toEqual(['fresh']); expect(eliteDamageMul(actor, new Vector3(), new Vector3())).toBe(.4);
    root.onDispose(() => undefined); const steps = root.disposeSteps();
    try {
      expect(steps.next().done).toBe(false); expect(fresh.disposed).toBe(false); expect(fresh.disposing).toBe(true);
      eliteThink(actor, context); expect(calls).toEqual(['fresh']);
      expect(eliteDamageMul(actor, new Vector3(), new Vector3())).toBe(1);
      expect(() => setEliteBrain(actor, () => undefined, fresh)).toThrow('Retired');
    } finally { for (const _step of steps) { /* Drain the original retirement. */ } }
  } finally { root.dispose(); }
});


test('observation admission checks the same immutable descriptors without capturing a climate frame', () => {
  for (const change of ['source', 'id', 'suffix', 'grass-owner']) {
    const f = fixture();
    try {
      const loan = f.loans.observations[1]; if (loan === undefined) throw new Error('Missing body inputs');
      const declarations = ELITE_BODY_COLUMNS;
      if (change === 'source') loan.columns = new ObservationColumnsV2(declarations.map(row => row.name === 'grassHeight' ? { ...row, source: { kind: 'grass', at: 'player' } } : row), f.entered);
      else if (change === 'id') loan.columns = new ObservationColumnsV2(declarations.map(row => ({ name: row.name, id: row.id + 10, source: row.source })), f.entered);
      else if (change === 'suffix') loan.columns = new ObservationColumnsV2(declarations.slice(0, -1), f.entered);
      else { const plan = prepareEliteEntry(f.input, f.loans); loan.owners.environment.grassHeightAt = vi.fn(() => 1); expect(() => plan.validate()).toThrow('Replaced'); continue; }
      expect(() => prepareEliteEntry(f.input, f.loans)).toThrow('declarations');
      expect(f.scene.children).toHaveLength(0); expect(f.spawn).not.toHaveBeenCalled();
    } finally {
      expect(f.loans.observations[0]?.owners.environment.grassHeightAt).not.toHaveBeenCalled();
      expect(f.loans.programs[0]?.program.project).not.toHaveBeenCalled(); f.root.dispose();
    }
  }
});


test('native input capture uses the current original actor xz and never the player point or a cached frame', () => {
  const f = fixture(), actor = legacyDouble<Animal>({ entityId: 'original.actor', position: new Vector3(-0, 7, -22) });
  try {
    const plan = prepareEliteEntry(f.input, f.loans), controllers = f.entered.run(plan.construct), native = controllers[0];
    if (!(native instanceof NativeEliteController)) throw new Error('Missing native controller');
    const observed = vi.spyOn(native, 'observe').mockImplementation(() => undefined), env = f.loans.observations[1]?.owners.environment;
    if (env === undefined) throw new Error('Missing environment');
    plan.observeNative(); expect(env.grassHeightAt).not.toHaveBeenCalled(); expect(observed.mock.calls[0]?.[0].grassHeight).toBe(0);
    native.animal = actor; f.actors.push(actor); env.grassHeightAt.mockReturnValue(.73);
    plan.observeNative(); expect(env.grassHeightAt).toHaveBeenCalledExactlyOnceWith(-0, -22);
    expect(observed.mock.calls[1]?.[0]).toEqual({ playerCrouched: false, playerFwdX: 0, playerFwdZ: 1, grassHeight: .73, wind: { x: 0, z: 1 } });
    actor.position.set(19, 4, 83); env.wind.x = -.2; env.playerCrouched = true;
    plan.observeNative(); expect(env.grassHeightAt.mock.calls[1]).toEqual([19, 83]); expect(observed.mock.calls[2]?.[0].wind.x).toBe(-.2); expect(observed.mock.calls[2]?.[0].playerCrouched).toBe(true);
    f.actors.length = 0; expect(() => plan.observeNative()).toThrow('Foreign'); expect(observed).toHaveBeenCalledTimes(3);
  } finally { f.root.dispose(); }
});

test('condition frames stay fresh at their original bounded ten-Hz slot with static fields in the original order', () => {
  const f = fixture();
  try {
    const plan = prepareEliteEntry(f.input, f.loans), projection = f.loans.programs[0]?.program.project, owners = f.loans.observations[0]?.owners;
    if (projection === undefined || owners === undefined) throw new Error('Missing conditions');
    expect(plan.holds('always')).toBe(false); plan.updateConditions(0); expect(plan.holds('always')).toBe(true);
    expect(projection.mock.calls[0]).toEqual(['rule', { phase: 0, storm: 0, rule: 0 }]);
    owners.weather.stormActive = true; plan.updateConditions(.049); plan.updateConditions(.05); expect(projection).toHaveBeenCalledTimes(1);
    plan.updateConditions(.001); expect(projection.mock.calls[1]).toEqual(['rule', { phase: 0, storm: 1, rule: 0 }]);
    plan.updateConditions(7); expect(projection).toHaveBeenCalledTimes(3);
    expect(f.loans.observations[1]?.owners.environment.grassHeightAt).not.toHaveBeenCalled();
    f.entered.dispose(); expect(() => plan.updateConditions(.1)).toThrow('Retired');
  } finally { f.root.dispose(); }
});


test('replacement during a first native allocation fences the remaining transaction and releases private UI resources', () => {
  const f = fixture(), removed = vi.fn<() => void>(() => undefined), borrowed = f.loans.models[0]?.object;
  f.scene.addEventListener('childremoved', removed);
  f.scene.addEventListener('childadded', () => { f.manager.spawn = () => { throw new Error('Foreign replacement'); }; });
  try {
    const plan = prepareEliteEntry(f.input, f.loans);
    expect(() => f.entered.run(plan.construct)).toThrow('Replaced');
    expect(f.scene.children).toHaveLength(0); expect(removed).toHaveBeenCalled(); expect(borrowed?.parent).toBeNull();
    expect(f.spawn).not.toHaveBeenCalled(); expect(f.retire).not.toHaveBeenCalled();
    expect(f.entered.disposed).toBe(false); expect(f.construction.disposed).toBe(false);
  } finally { f.root.dispose(); }
});


test('engine row orchestration preserves registry/add order and the original observe/condition/update/drain slots', () => {
  const f = fixture(), registry = new EncounterRegistry(() => f.construction), order: string[] = [];
  const frame = { patrolAvailable: true, herdAvailable: false, kills: 5, bonded: false, mount: null };
  f.lifecycle.add.mockImplementation(script => {
    expect(registry.runtime(script.def.id) === script).toBe(true);
    if (script.def.id === f.def.id) expect(registry.runtime(f.borrowed.def.id)).toBeUndefined();
    f.lifecycle.entries.push({ script });
  });
  try {
    const plan = prepareEliteEntry(f.input, f.loans), bound = plan.bind(f.lifecycle, registry, new Set());
    expect(bound.scripts[1] === f.borrowed).toBe(true);
    const native = bound.scripts[0]; if (!(native instanceof NativeEliteController)) throw new Error('Missing native controller');
    vi.spyOn(native, 'observe').mockImplementation(() => { order.push('native.observation'); });
    f.loans.programs[0]?.program.project.mockImplementation(() => { order.push('condition'); return { accept: 1 }; });
    f.borrowed.observe.mockImplementation(() => { order.push('external.observation'); });
    f.lifecycle.initialize.mockImplementation(() => { order.push('initialize'); });
    f.lifecycle.update.mockImplementation(() => { order.push('update'); });
    f.lifecycle.drainEnteredOutputs.mockImplementation(() => { order.push('drain'); });
    bound.initialize(frame); expect(order).toEqual(['native.observation', 'external.observation', 'initialize', 'drain']);
    order.length = 0; bound.update(.1, 377.25, frame);
    expect(order).toEqual(['native.observation', 'condition', 'external.observation', 'update', 'drain']);
    expect(f.lifecycle.update.mock.calls[0]).toEqual([.1, 377.25]);
    expect(f.borrowed.observe.mock.calls.at(-1)).toEqual([.1, { available: true, kills: 5, bonded: false, mount: null }]);
    f.entered.dispose(); expect(registry.runtime(f.def.id)).toBeUndefined(); expect(registry.runtime(f.borrowed.def.id)).toBeUndefined();
    expect(f.borrowed.despawn).toHaveBeenCalledTimes(1); expect(() => bound.update(.1, 378, frame)).toThrow('Retired');
  } finally { f.root.dispose(); }
});

test('occupied suffix and replaced lifecycle owners refuse before conditions or native allocation', () => {
  for (const change of ['occupied', 'method']) {
    const f = fixture(), registry = new EncounterRegistry(() => f.construction);
    try {
      const plan = prepareEliteEntry(f.input, f.loans);
      if (change === 'occupied') registry.elite(f.borrowed.def.id, { despawn: () => undefined }, f.construction);
      else f.lifecycle.signature = vi.fn(() => undefined);
      expect(() => plan.bind(f.lifecycle, registry, new Set())).toThrow();
      expect(f.scene.children).toHaveLength(0); expect(f.loans.programs[0]?.program.project).not.toHaveBeenCalled(); expect(f.spawn).not.toHaveBeenCalled();
    } finally { f.root.dispose(); }
  }
});

test('invalid frame and retirement inside lifecycle update cannot publish a later drain', () => {
  const f = fixture(), registry = new EncounterRegistry(() => f.construction), frame = { patrolAvailable: true, herdAvailable: false, kills: 0, bonded: false, mount: null };
  try {
    const bound = prepareEliteEntry(f.input, f.loans).bind(f.lifecycle, registry, new Set());
    expect(() => bound.update(.1, 10, { ...frame, kills: Number.NaN })).toThrow('frame'); expect(f.borrowed.observe).not.toHaveBeenCalled(); expect(f.lifecycle.update).not.toHaveBeenCalled();
    f.lifecycle.update.mockImplementation(() => { f.entered.dispose(); });
    expect(() => bound.update(.1, 10, frame)).toThrow('Retired'); expect(f.lifecycle.drainEnteredOutputs).not.toHaveBeenCalled();
  } finally { f.root.dispose(); }
});


test('the canonical native binding keeps legacy unscoped setters independent of an entered owner', () => {
  const actor = legacyDouble<Animal>({}), context = legacyDouble<ThinkCtx>({}), calls: string[] = [];
  setEliteBrain(actor, () => { calls.push('original'); });
  setEliteDamage(actor, () => .6);
  eliteThink(actor, context); expect(calls).toEqual(['original']); expect(eliteDamageMul(actor, new Vector3(), new Vector3())).toBe(.6);
});


test('declared engine entry is inert before binding and permits re-entry only after the previous disposal completes', () => {
  const f = fixture(), entry = new DeclaredEliteEntry<typeof f.borrowed>(f.input, f.construction), registry = new EncounterRegistry(() => f.construction);
  const frame = { patrolAvailable: false, herdAvailable: false, kills: 0, bonded: false, mount: null };
  let next: ReturnType<typeof fixture> | null = null;
  try {
    entry.update(.1, 1, frame); entry.initialize(frame); expect(entry.holds('always')).toBe(false); expect(entry.scripts).toEqual([]); expect(entry.bar).toBeNull();
    entry.bind(f.loans, f.lifecycle, registry); expect(entry.scripts[1] === f.borrowed).toBe(true); expect(entry.bar === f.loans.ui.services.bar).toBe(true);
    expect(() => entry.bind(f.loans, f.lifecycle, registry)).toThrow('occupied');
    next = fixture(f.construction);
    f.entered.onDispose(() => undefined); const steps = f.entered.disposeSteps();
    try {
      expect(steps.next().done).toBe(false); expect(f.entered.disposed).toBe(true); expect(f.entered.disposing).toBe(true);
      entry.update(.1, 1, frame); expect(f.lifecycle.update).not.toHaveBeenCalled(); expect(entry.holds('always')).toBe(false);
      const pending = next;
      expect(() => entry.bind(pending.loans, pending.lifecycle, registry)).toThrow('occupied');
    } finally { for (const _step of steps) { /* Finish the original entered retirement. */ } }
    entry.bind(next.loans, next.lifecycle, registry);
    expect(entry.scripts[1] === next.borrowed).toBe(true); entry.update(.1, 18.75, frame);
    expect(next.lifecycle.update.mock.calls[0]).toEqual([.1, 18.75]);
  } finally { next?.root.dispose(); f.root.dispose(); }
});


test('the original game lifecycle is lent directly without a compatible wrapper or factory', () => {
  expectTypeOf<Elites>().toExtend<EliteEntryLifecycle<ExternalElitePage>>();
});


function originalOwnerFixture() {
  const f = fixture(), services = f.loans.ui.services;
  f.input.entries = f.input.entries.slice(0, 1);
  const entry = new DeclaredEliteEntry<ExternalElitePage>(f.input, f.construction);
  const saved = { read: () => ({}), write: () => true }, persistence = legacyDouble<AdventurePersistence>({ elites: saved, kill: () => undefined, feat: () => undefined });
  const elites = f.entered.run(() => new Elites({ scene: f.scene, camera: services.game.camera, player: services.player,
    condition: rule => entry.holds(rule), ownSkin: skin => { entry.skins.add(skin); } }, services.bar, 'marsh', saved));
  f.entered.expose(services.game, 'app', app); f.entered.expose(services.game, 'renderer', legacyDouble<Game['renderer']>({})); f.entered.expose(app, 'levelScope', f.construction);
  f.entered.expose(app, 'physics', null);
  const sample = f.loans.observations[0]?.owners;
  if (sample === undefined) throw new Error('Missing sample owners');
  const rows = { entry: f.input, actions: f.loans.actions, profiles: f.loans.profiles, borrowed: [],
    observations: [{ id: 'condition.inputs', rows: ELITE_CONDITION_COLUMNS }, { id: 'reed.inputs', rows: ELITE_BODY_COLUMNS }],
    presentation: { [f.def.id]: { prompt: 'Take', toast: 'Taken', hum: false, sting: { banner: 0, phase2: 0, kill: 'pickup' } } },
    strikes: [], fallbackStrike: strike(strikes.captain), prewarm: [] };
  const owners: EliteDeclaredEntryOwners = { construction: f.construction, entered: { scope: f.entered, interactables: [],
    hud: legacyDouble<HUD>({ killFeed: () => undefined }), audio: legacyDouble<Audio>({ animal: () => undefined }), music: legacyDouble<Music>({}) },
    game: services.game, player: services.player, body: 'animals', animals: f.manager, models: new Map([['reed.model', f.model]]),
    program: { id: 'rules', scope: f.construction, value: legacyDouble<ReturnProgram>({ project: () => ({ accept: 1 }) }) }, controllers: [],
    environment: legacyDouble<PageWildEnvironment & V2EnvironmentColumns>({ ...sample.environment, onKnockdown: () => undefined }), clock: legacyDouble<DayCycleClock>(sample.clock),
    weather: sample.weather, ledges: [], rock: services.rock, patrol: null, wildlife: null, persistence, contacts: new StrikeRunner() };
  return { f, entry, elites, rows, owners };
}

test('original Elites owner binds engine-selected native controllers without a replacement roster or save authority', () => {
  const { f, entry, elites, rows, owners } = originalOwnerFixture();
  try {
    f.entered.run(() => elites.bindDeclaredEntry(entry, rows, owners));
    expect(entry.scripts).toHaveLength(1); expect(entry.scripts[0]).toBeInstanceOf(NativeEliteController);
    expect(elites.entries[0]?.script === entry.scripts[0]).toBe(true);
    expect(app.encounters.runtime(f.def.id) === entry.scripts[0]).toBe(true);
    expect(elites.v2OutputActions).toEqual(rows.actions); expect(f.spawn).not.toHaveBeenCalled();
    const frame = { patrolAvailable: false, herdAvailable: false, kills: 0, bonded: false, mount: null };
    const updated = vi.spyOn(elites, 'update');
    f.entered.dispose(); entry.update(.1, 77, frame); expect(updated).not.toHaveBeenCalled();
    expect(app.encounters.runtime(f.def.id)).toBeUndefined(); expect(() => elites.v2OutputActions).toThrow('Retired');
  } finally { f.root.dispose(); }
});

test('the original owner refuses missing presentation/model and foreign persistence before native effects', () => {
  for (const change of ['presentation', 'model', 'persistence', 'effect-sink', 'getter']) {
    const { f, entry, elites, rows, owners } = originalOwnerFixture(), read = vi.fn(() => rows.entry);
    try {
      if (change === 'presentation') delete rows.presentation[f.def.id];
      else if (change === 'model') f.entered.expose(owners, 'models', new Map());
      else if (change === 'persistence') f.entered.expose(owners.persistence, 'elites', { read: () => ({}), write: () => true });
      else if (change === 'effect-sink') f.entered.expose(owners.entered.hud, 'killFeed', null);
      else Object.defineProperty(rows, 'entry', { get: read });
      expect(() => f.entered.run(() => elites.bindDeclaredEntry(entry, rows, owners))).toThrow();
      expect(read).not.toHaveBeenCalled(); expect(f.scene.children).toHaveLength(0); expect(elites.entries).toHaveLength(0);
      expect(f.spawn).not.toHaveBeenCalled(); expect(app.encounters.runtime(f.def.id)).toBeUndefined();
    } finally { f.root.dispose(); }
  }
});


test('a late effect-sink replacement rolls back the whole entered allocation and registry transaction', () => {
  const { f, entry, rows, owners } = originalOwnerFixture(), attempt = f.entered.child('Elites.bind');
  const original: unknown = Reflect.get(owners.entered.hud, 'killFeed');
  const replaced = (): void => { attempt.expose(owners.entered.hud, 'killFeed', null); };
  f.scene.addEventListener('childadded', replaced);
  try {
    expect(() => {
      try { attempt.run(() => {
        const owner = new Elites({ scene: f.scene, camera: owners.game.camera, player: owners.player,
          condition: rule => entry.holds(rule) }, f.loans.ui.services.bar, 'marsh', owners.persistence.elites);
        owner.bindDeclaredEntry(entry, rows, { ...owners, entered: { ...owners.entered, scope: attempt } });
      }); } catch (error) { attempt.dispose(); throw error; }
    }).toThrow('effect sink');
    expect(attempt.disposed).toBe(true); expect(f.scene.children).toHaveLength(0);
    expect(attempt.census.resources).toBe(0); expect(attempt.census.geometries).toBe(0);
    expect(attempt.census.materials).toBe(0); expect(app.encounters.runtime(f.def.id)).toBeUndefined();
    expect(entry.scripts).toEqual([]); expect(f.spawn).not.toHaveBeenCalled();
    expect(owners.entered.hud.killFeed === original).toBe(true);
  } finally { f.scene.removeEventListener('childadded', replaced); f.root.dispose(); }
});


test('the original admitted condition guest keeps its exact six-frame night transition under engine ownership', () => {
  const f = fixture(), condition = f.input.conditions[0], loan = f.loans.programs[0], observed = f.loans.observations[0];
  if (condition === undefined || loan === undefined || observed === undefined) throw new Error('Missing condition owner');
  condition.signal = 'eliteRule'; condition.observations = [{ field: 'rule', value: 2 }];
  try {
    const plan = prepareEliteEntry(f.input, { ...f.loans, programs: [{ id: loan.id, owner: f.construction, program: ReturnProgram.page(admission, f.construction) }] });
    plan.updateConditions(0); expect(plan.holds('always')).toBe(false);
    f.entered.expose(observed.owners.clock, 'dayPhase', 'night');
    for (let frame = 0; frame < 5; frame++) plan.updateConditions(1 / 60);
    expect(plan.holds('always')).toBe(false); plan.updateConditions(1 / 60); expect(plan.holds('always')).toBe(true);
  } finally { f.root.dispose(); }
});


test('deferred concrete presentation preserves the original native-then-external geometry allocation order', () => {
  const old = fixture(), next = fixture(), template = ecology.externalElites.find(row => row.mode === 'herd');
  if (template === undefined) throw new Error('Missing herd template');
  const row = parseExternalElite({ ...template, def: { ...template.def, id: next.borrowed.def.id, rule: 'always' } });
  const projected = vi.fn<ReturnProgram['project']>(() => ({})), guest = legacyDouble<ReturnProgram>({ project: projected });
  const external = (f: ReturnType<typeof fixture>, defer: boolean): ExternalElitePage => f.entered.run(() => new ExternalElitePage(row,
    { game: f.loans.ui.services.game, player: f.loans.ui.services.player, animals: f.manager, elites: legacyDouble<Elites>({}) }, guest, new Group(), undefined, defer));
  const geometry = (scene: Scene) => scene.children.map(object => {
    if (!(object instanceof Mesh)) throw new Error('Unexpected constructor allocation');
    const buffer: unknown = object.geometry; if (!(buffer instanceof BufferGeometry)) throw new Error('Unexpected constructor geometry');
    const positions: unknown = buffer.getAttribute('position'); if (!(positions instanceof BufferAttribute)) throw new Error('Unexpected constructor positions');
    return { position: Array.from(positions.array), indices: Array.from(buffer.index?.array ?? []), order: object.renderOrder, visible: object.visible };
  });
  try {
    old.entered.run(() => new NativeEliteController({ ...old.profile, variant: 'silver', offset: [3, -2], tell: [.2, .7, .5], beam: [.5, .4, .8] },
      { ...old.loans.ui.services, animals: old.manager }, old.model));
    external(old, false);
    const borrowed = external(next, true); expect(next.scene.children).toHaveLength(0);
    const plan = prepareEliteEntry(next.input, { ...next.loans, controllers: [{ id: 'original.rider', controller: borrowed }] });
    next.entered.run(plan.construct);
    expect(geometry(next.scene)).toEqual(geometry(old.scene)); expect(next.scene.children).toHaveLength(2);
    expect(projected).not.toHaveBeenCalled(); expect(next.spawn).not.toHaveBeenCalled();
    expect(() => next.entered.run(() => borrowed.prepareEntered())).toThrow('phase');
    next.entered.dispose(); expect(next.scene.children).toHaveLength(0);
  } finally { old.root.dispose(); next.root.dispose(); }
});


test('a replacement after borrowed presentation allocation unwinds both native and external UI without retiring entered owners', () => {
  const f = fixture(), template = ecology.externalElites.find(row => row.mode === 'herd');
  if (template === undefined) throw new Error('Missing herd template');
  const row = parseExternalElite({ ...template, def: { ...template.def, id: f.borrowed.def.id, rule: 'always' } });
  const borrowed = f.entered.run(() => new ExternalElitePage(row, { game: f.loans.ui.services.game, player: f.loans.ui.services.player,
    animals: f.manager, elites: legacyDouble<Elites>({}) }, legacyDouble<ReturnProgram>({}), new Group(), undefined, true));
  let added = 0;
  f.scene.addEventListener('childadded', () => { added++; if (added === 2) f.manager.spawn = () => { throw new Error('Foreign body owner'); }; });
  try {
    const plan = prepareEliteEntry(f.input, { ...f.loans, controllers: [{ id: 'original.rider', controller: borrowed }] });
    expect(() => f.entered.run(plan.construct)).toThrow('Replaced');
    expect(added).toBe(2); expect(f.scene.children).toHaveLength(0); expect(f.entered.disposed).toBe(false);
    expect(f.entered.census.geometries).toBe(0); expect(f.entered.census.materials).toBe(0); expect(f.spawn).not.toHaveBeenCalled();
  } finally { f.root.dispose(); }
});


test('the complete original native profile bank admits its bounded audio cue identifiers unchanged', () => {
  const f = fixture(), rows = buildEliteEntryPageRows(), observed = f.loans.observations[0], program = f.loans.programs[0];
  if (observed === undefined || program === undefined) throw new Error('Missing fixture authority');
  try {
    const plan = prepareEliteEntry(rows.entry, { ...f.loans, ui: { ...f.loans.ui, id: rows.entry.ui }, profiles: rows.profiles,
      models: ecology.keeperElites.map(row => ({ id: row.def.id, object: new Group() })), bodies: [{ id: 'animals', manager: f.manager }],
      observations: rows.observations.map(row => ({ id: row.id, columns: new ObservationColumnsV2(row.rows, f.entered), owners: observed.owners })),
      programs: [{ ...program, id: 'elite.rules' }], controllers: rows.borrowed.map(row => ({ id: row.def.id, controller: { ...f.borrowed, def: row.def, row: { mode: row.mode } } })), actions: rows.actions });
    expect(f.scene.children).toHaveLength(0); expect(f.spawn).not.toHaveBeenCalled();
    const scripts = f.entered.run(plan.construct), native = scripts.filter(row => row instanceof NativeEliteController);
    expect(native.map(row => row.row.voices)).toEqual(ecology.keeperElites.map(row => row.voices));
    expect(native).toHaveLength(3); expect(scripts.map(row => row.def.id)).toEqual(rows.entry.entries.map(row => row.id));
    expect(f.spawn).not.toHaveBeenCalled();
  } finally { f.root.dispose(); }
});


test('the phone frame contract reads authored handles from the public probe and never raw Game.runtime', () => {
  const game = legacyDouble<Game>({ renderer: legacyDouble<Game['renderer']>({ info: legacyDouble<Game['renderer']['info']>({
    render: { frame: 1, calls: 2, triangles: 0, points: 0, lines: 0 },
  }) }) });
  const probe = { app: { state: 'play' as const }, world: { game }, shard: { slug: 'nalati-grasslands', nalati: { elites: { scripts: [{ def: { id: 'original.elite' } }] } } } };
  expect(eliteEntryProbeFrame(probe)).toEqual({ ids: ['original.elite'], frames: 1, calls: 2 });
  expect(() => eliteEntryProbeFrame({ ...probe, shard: { slug: probe.shard.slug } })).toThrow('authored elite exposure');
  expect(() => eliteEntryProbeFrame({ ...probe, world: undefined })).toThrow('entered play');
});


test('admitted borrowed rows construct the original controller inside the existing entered binding', () => {
  const { f, elites, rows, owners } = originalOwnerFixture();
  const source = ecology.externalElites.find(row => row.mode === 'herd');
  if (source === undefined) throw new Error('Missing original herd law');
  const borrowed = parseExternalElite({ ...source, def: { ...source.def, rule: 'always' } });
  const row = { ...rows, borrowed: [borrowed], entry: { ...rows.entry, entries: [...rows.entry.entries,
    { id: borrowed.def.id, condition: 'always', controller: { kind: 'borrowed' as const, controller: borrowed.def.id } }] },
    presentation: { ...rows.presentation, [borrowed.def.id]: { prompt: 'Take', toast: 'Taken', hum: false, sting: { banner: 0, phase2: 0, kill: 'pickup' as const } } } };
  const entry = new DeclaredEliteEntry<ExternalElitePage>(row.entry, f.construction), model = new Group();
  f.entered.expose(owners, 'controllers', undefined);
  f.entered.expose(owners, 'models', new Map([...owners.models, [borrowed.def.id, model]]));
  try {
    f.entered.run(() => elites.bindDeclaredEntry(entry, row, owners));
    const controller = entry.scripts[1];
    expect(controller).toBeInstanceOf(ExternalElitePage);
    if (!(controller instanceof ExternalElitePage)) throw new Error('Missing original borrowed controller');
    expect(controller.row).toEqual(borrowed); expect(controller.def.id).toBe(borrowed.def.id);
    expect(controller.dropModel()).not.toBe(model); expect(elites.entries[1]?.script === controller).toBe(true);
    expect(f.spawn).not.toHaveBeenCalled();
    f.entered.dispose(); expect(f.scene.children).toHaveLength(0);
  } finally { f.root.dispose(); }
});

test('missing final borrowed model refuses before any native kernel or tell is published', () => {
  const { f, elites, rows, owners } = originalOwnerFixture();
  const source = ecology.externalElites.find(row => row.mode === 'herd');
  if (source === undefined) throw new Error('Missing original herd law');
  const borrowed = parseExternalElite({ ...source, def: { ...source.def, rule: 'always' } });
  const row = { ...rows, borrowed: [borrowed], entry: { ...rows.entry, entries: [...rows.entry.entries,
    { id: borrowed.def.id, condition: 'always', controller: { kind: 'borrowed' as const, controller: borrowed.def.id } }] },
    presentation: { ...rows.presentation, [borrowed.def.id]: { prompt: 'Take', toast: 'Taken', hum: false, sting: { banner: 0, phase2: 0, kill: 'pickup' as const } } } };
  const entry = new DeclaredEliteEntry<ExternalElitePage>(row.entry, f.construction);
  f.entered.expose(owners, 'controllers', undefined);
  try {
    expect(() => f.entered.run(() => elites.bindDeclaredEntry(entry, row, owners))).toThrow('borrowed elite model');
    expect(f.scene.children).toHaveLength(0); expect(elites.entries).toHaveLength(0); expect(f.spawn).not.toHaveBeenCalled();
    expect(app.encounters.runtime(f.def.id)).toBeUndefined();
  } finally { f.root.dispose(); }
});
