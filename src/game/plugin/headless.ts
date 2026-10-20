import { bindPageHomes, bindPageBoss, bindPageActor, spawnPageHome } from '../population/pageHomes';
import { installPageItems, installPageItemContexts } from '../shardfile/pageItems';
import { bindPageQuest } from '../quest/pageState';
import { createQuestLedger } from '../quest/ledger';
import type { installCableModes } from '@wildshard/engine/player/modes';
import { macrotask, slicer } from '@wildshard/engine/boot/plan';
import { parseItems } from '@wildshard/format/items';
import * as v from 'valibot';
import type { Progress } from "../Progress";
import { legacyContentIdentity } from "../shard/list";
import type { EquipmentIcon } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily, ItemFamilyPresentation } from '@wildshard/engine/combat/itemFamilies';
import type { QuestState, QuestMarker } from '@wildshard/engine/quest/core';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShardContext } from './context';
import type { LedgerReceipt } from "../ledger";
import { Purse } from "../loot/Purse";
import type { DeclaredItems, DeclaredItemPorts } from "../shardfile/items";
import type { RuntimeBoundSection } from "@wildshard/format/runtimeBinds";
import type { RuntimeActorRow, RuntimeBossRow } from "@wildshard/format/runtimeSpawns";
import type { Shardfile } from "@wildshard/format/shardSchema";
import { installRuntimeState, type RuntimeState, type RuntimeStateValue } from "../shardfile/runtimeState";


/**
 * The runtime-owner binding (SHARD-PLATFORM M3, E435). A hybrid shard's trusted runtime owns its world and its play scope;
 * the behaviour sections it names in `runtime.binds` stay declared data, and these installers put them into that scope
 * (the entered `runtime:<instance>` scope in a grid cell, the level scope standalone) through the template's own
 * installers: the platform `Ledger`, engine `QuestState`, `installDeclaredItems`, the platform `Purse`, and the home keeper
 * for its declared creatures (`runtime.spawns`). The runtime binds to the result; it never
 * rebuilds the rows. The data client installs none of a bound section (`withoutRuntimeRows`).
 */

type QuestRow = Shardfile['quests']['quests'][number];
type MarkerRow = NonNullable<QuestRow['steps'][number]['markers']>[number];

/** The sections `source` declares its runtime binds; empty for a pure-data shard. */
export function runtimeBinds(source: Pick<Shardfile, 'runtime'>): ReadonlySet<RuntimeBoundSection> {
  return new Set(source.runtime?.binds);
}

function requireBound(source: Pick<Shardfile, 'runtime'>, section: RuntimeBoundSection): void {
  if (source.runtime === null) throw new Error(`Runtime-bound ${section} needs a trusted runtime declaration`);
  if (!runtimeBinds(source).has(section)) throw new Error(`Shardfile ${section} are not bound by its runtime (runtime.binds)`);
}

/**
 * The immutable files only a runtime-bound world section references (G227): the terrain's collider and tile files, the
 * props' tile, library, panel, far and texture files. Admission still fetches and verifies them with the product; the data
 * client's view drops them so a hybrid whose world is bound stays an empty data declaration.
 */
export function runtimeBoundWorldFiles(source: Shardfile): ReadonlySet<string> {
  const binds = runtimeBinds(source), files = new Set<string>();
  if (binds.has('terrain') && source.terrain !== null) for (const ref of [source.terrain.collider,
    ...(source.terrain.sampling === undefined ? [] : [source.terrain.sampling.file]), ...source.terrain.tiles.map((tile) => tile.file)]) files.add(ref);
  const props = source.props;
  if (binds.has('props') && props !== null) {
    for (const ref of [...props.tiles.flatMap((tile) => [tile.file, ...tile.additionalFiles ?? []]), ...props.panels.map((panel) => panel.file), ...props.models.map((model) => model.file), ...props.wholeLibrary ?? [],
      ...props.textures.flatMap((texture) => [texture.model, texture.colour]), ...(props.far === null ? [] : [props.far])]) files.add(ref);
  }
  if (binds.has('movers')) for (const row of source.movers) files.add(row.module);
  if (files.size === 0) return files;
  // a file another (unbound) declaration still names stays the data client's
  const moverModules = new Set(binds.has('movers') ? source.movers.map(row => row.module) : []);
  const unbound = { ...source, movers: binds.has('movers') ? [] : source.movers, sim: { ...source.sim, scripts: source.sim.scripts.filter(ref => !moverModules.has(ref)) }, terrain: binds.has('terrain') ? null : source.terrain, props: binds.has('props') ? null : source.props, tiles: [], files: [], critical: [], library: [], far: null };
  const text = JSON.stringify(unbound);
  for (const ref of files) if (text.includes(ref)) files.delete(ref);
  return files;
}

function withoutDrawnProps(props: Shardfile['props']): Shardfile['props'] {
  if (props === null) return null;
  const { wholeLibrary: _wholeLibrary, ...rows } = props;
  return { ...rows, tiles: [], panels: [], models: [], far: null, textures: [] };
}

/** The source as the data client installs it: every runtime-bound section emptied, so neither installs it twice. */
export function withoutRuntimeRows(source: Shardfile): Shardfile {
  const binds = runtimeBinds(source);
  if (binds.size === 0) return source;
  if (binds.has('state') && (source.state.player.length > 0 || source.state.shared.some((field) => field.privacy !== 'host' && !(field.privacy === 'public' && field.type !== 'string' && (source.runtime?.spawns?.bosses.length ?? 0) > 0)))) {
    throw new Error('Runtime-bound state supports host fields and retained-actor numeric fields');
  }
  const world = runtimeBoundWorldFiles(source), keep = (ref: string): boolean => !world.has(ref);
  const far = source.far === null || source.far.files.every(keep) ? source.far : source.far.files.some(keep) ? { ...source.far, files: source.far.files.filter(keep) } : null;
  return { ...source,
    ...(binds.has('terrain') ? { terrain: null } : {}),
    // bound props keep their collider rows (an entry's landings are platform data, like the edges); the drawn content is the runtime's
    ...(binds.has('props') ? { props: withoutDrawnProps(source.props) } : {}),
    ...(world.size === 0 ? {} : { files: source.files.filter((file) => keep(file.hash)), critical: source.critical.filter(keep), library: source.library.filter(keep), far,
      tiles: source.tiles.flatMap((tile) => { const files = tile.files.filter(keep); return files.length === 0 ? [] : [files.length === tile.files.length ? tile : { ...tile, files }]; }) }),
    ...(binds.has('movers') ? { movers: [], sim: { ...source.sim, scripts: source.sim.scripts.filter(keep) } } : {}),
    ...(binds.has('modes') ? { modes: { traverse: [] } } : {}),
    ...(binds.has('clientChannels') ? { clientChannels: [] } : {}),
    ...(binds.has('quests') ? { quests: { flags: [], quests: [], triggers: [], dialogue: [] },
      ...(source.questNpcs === undefined ? {} : { questNpcs: [] }),
      ...(source.questHost === undefined ? {} : { questHost: null }) } : {}),
    ...(binds.has('ledger') ? { ledger: [] } : {}),
    ...(binds.has('loot') ? { rows: { ...source.rows, loot: [] } } : {}),
    ...(binds.has('items') ? { items: { version: 1, rows: [], contexts: [], loadout: { primary: null, secondary: null, tools: [] } } } : {}),
    ...(binds.has('state') ? { state: { ...source.state, shared: [], player: [] } } : {}),
  };
}

/** Bind one declared host state field; legacy scalar/JSON-string data migrates once, never written by the shard again. */
export function bindRuntimeState(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile, key: string,
  legacyRead: () => RuntimeStateValue | null, instance = source.identity.slug): RuntimeState {
  requireBound(source, 'state');
  // Frozen copies never existed under the primary save namespace; fresh fields start from declared defaults.
  const content = legacyContentIdentity(source.identity.slug);
  const migrate = content === undefined ? legacyRead : () => null;
  return installRuntimeState(ctx.app.saves, ctx.scope, source, instance, key, migrate);
}

/** A typed JSON record on one declared state field. Legacy reads run only at first initialization;
 * namespaces cannot escape the bound placement, and refused writes remain explicit boolean results. */
export function bindRuntimeJsonRecord<S extends v.GenericSchema>(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile,
  key: string, schema: S, legacyRead: () => v.InferOutput<S>, instance = source.identity.slug): {
  readonly read: (namespace?: string) => v.InferOutput<S>; readonly write: (value: v.InferOutput<S>, namespace?: string) => boolean;
} {
  const field = bindRuntimeState(ctx, source, key, () => JSON.stringify(legacyRead()), instance);
  const owner = (namespace: string): void => { if (namespace !== instance) throw new Error('JSON record belongs to another instance'); };
  return { read: (namespace = instance) => {
    owner(namespace);
    const text = field.read(); if (typeof text !== 'string') throw new Error('Runtime JSON state must be a string');
    const value: unknown = JSON.parse(text); return v.parse(schema, value);
  }, write: (value, namespace = instance) => { owner(namespace); return field.write(JSON.stringify(v.parse(schema, value))); } };
}

/** Emit one declared fact for an entity; the platform ledger decides the grant. */
export interface RuntimeFacts {
  (name: string, entity: string): LedgerReceipt;
  /** Retry pending writes from this exact ledger; false refuses the runtime's durable checkpoint. */
  readonly flush: () => boolean;
  /** Read this shard's achievement from the emitting ledger, including pending state; never grants. */
  readonly achievement: (id: string) => { readonly count: number; readonly earned: boolean } | undefined;
}

/**
 * Bind the declared ledger rules for a runtime that has no simulation host: each fact is stamped tick 0 and told apart by
 * its entity, so a replayed or reloaded fact is the same fact and grants nothing twice (SF14). `instance` is the
 * first-party placement id.
 */
export function bindRuntimeLedger(ctx: Pick<ShardContext, 'app'>, source: Shardfile, instance: string): RuntimeFacts {
  requireBound(source, 'ledger');
  return createQuestLedger(ctx.app.saves, source, instance);
}

/** Project an existing runtime ledger into its caller-owned Progress view. The emitter remains the sole grant/write
 * owner. Each successful or duplicate emission refreshes once; a thrown emission does not refresh. Pending-write
 * retries and achievement reads are the exact original ports, and an absent view installs no presentation. */
export function projectRuntimeFacts(emit: RuntimeFacts, progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined): RuntimeFacts & {
  /** Bind a later view or replace it; the caller can checkpoint its state before the ledger flush. */
  readonly bindProgress: (view: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined, checkpoint?: () => boolean) => void;
} {
  let current = progress;
  const facts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); current?.refreshLedger(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement, bindProgress: (view: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined, checkpoint = emit.flush): void => {
    current = view;
    view?.bindLedger({ count: (id) => facts.achievement(id)?.count ?? 0,
      earned: (id) => facts.achievement(id)?.earned ?? false, checkpoint });
  } });
  facts.bindProgress(progress);
  return facts;
}

/** What a runtime lends a declared quest: its flags, built marker positions and an optional trusted presentation override. */
export interface RuntimeQuestPorts {
  readonly flags: Flags;
  /** Required when the quest's `onComplete` names a fact. */
  readonly facts?: RuntimeFacts;
  /** The marker's spot on its built piece (the world decides its height); `undefined` keeps the declared spot. */
  readonly place?: (marker: MarkerRow) => QuestMarker['at'] | undefined;
  /** A chip for a step, overriding the declared one. */
  readonly chip?: (step: QuestRow['steps'][number]) => string | undefined;
}
/** A declared quest bound into the runtime's play scope. Coins are the runtime's to pay (its purse and its beat). */
export interface RuntimeQuest {
  /** The mode host's admitted cable owner, on this quest's existing scope and flags. */
  readonly cables: ReturnType<typeof installCableModes>;
  readonly state: QuestState;
  readonly declared: QuestRow;
  readonly reward: { readonly coins: number; readonly fact: string | null };
}

/**
 * Build one declared quest's state over the runtime's flags, scoped to its play scope. The `onComplete` fact is emitted
 * through the bound ledger when the quest completes, and once on bind for a save that finished it before facts existed.
 */
export function bindRuntimeQuest(ctx: Pick<ShardContext, 'app' | 'scope'> & Partial<Pick<ShardContext, 'product'>>, source: Shardfile, id: string, ports: RuntimeQuestPorts): RuntimeQuest {
  requireBound(source, 'quests');
  const modeSource = runtimeBinds(source).has('modes') ? ctx.product : null;
  if (modeSource === undefined) throw new Error('Runtime-bound modes require an admitted product');
  return bindPageQuest(ctx, source, id, ports, modeSource === null ? source.modes : modeSource.shardfile.modes);
}

/** What a runtime lends its declared items: its own families (`<slug>.<name>`) and the icon resolver. */
export interface RuntimeItemPorts {
  readonly families: ReadonlyMap<string, ItemFamily>;
  readonly icon: (name: string) => EquipmentIcon;
  /** The platform kit's families, when the shard's rows also name `kit.*` ones. */
  readonly kit?: ReadonlyMap<string, ItemFamily>;
  /** Actor-owned hooks bound to the runtime's existing composed lane; every declared hook must resolve. */
  readonly hooks?: ReadonlyMap<string, ReturnType<DeclaredItemPorts['runtime']>['hook']>;
}

/**
 * Install declared items inside the runtime's equipment flow. Trusted families own contacts;
 * optional hooks come from the already admitted composed lane, so the item runtime sees no targets.
 */
export function bindRuntimeItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, source: Shardfile, ports: RuntimeItemPorts): DeclaredItems {
  requireBound(source, 'items');
  return installPageItems(ctx, source, ports);
}

type RuntimeWeaponFamily = Extract<ItemFamily, { kind: 'weapon' }>;
/** One declared primary melee family, created or adopted inside the existing equipment flow. */
export interface RuntimeMeleePorts<W extends ReturnType<RuntimeWeaponFamily['create']>> {
  readonly create: (...args: Parameters<RuntimeWeaponFamily['create']>) => W;
  readonly icon: RuntimeItemPorts['icon']; readonly hooks?: RuntimeItemPorts['hooks'];
  readonly presentation?: RuntimeWeaponFamily['presentation'];
}

/**
 * Resolve declared item input definitions in the runtime's play stage. Retained homes keep definitions until disposal,
 * with actions enabled and binding descriptions installed only while entered; ordinary levels keep their level scope.
 */
export function bindRuntimeItemContexts(ctx: ShardContext, source: Shardfile): void {
  requireBound(source, 'items');
  installPageItemContexts(ctx, source);
}

/** A runtime's coin port: what a declared quest or an encounter pays, in whole coins. */
export type RuntimeCoins = (share: number) => void;
/**
 * Bind the coins a runtime pays (a quest's `onComplete.coins`, a boss's reward burst) to the platform purse: the level's
 * loot purse in play, else (headless: tests, a node bake) the platform `Purse` for the shard. The runtime never writes the
 * coin save itself, as the full client's quest coin port.
 */
export function bindRuntimeCoins(ctx: Pick<ShardContext, 'manifest'>, purse: Purse | null): RuntimeCoins {
  let owner = purse;
  return (share) => { owner ??= new Purse(ctx.manifest.slug); owner.add(share); };
}

/** The declared runtime spawn rows, refused unless the runtime binds `spawns`. */
export function runtimeSpawnRows(source: Pick<Shardfile, 'runtime'>): NonNullable<NonNullable<Shardfile['runtime']>['spawns']> {
  requireBound(source, 'spawns');
  const rows = source.runtime?.spawns; if (rows === undefined) throw new Error('Runtime-bound spawns need runtime.spawns rows');
  return rows;
}
type Animals = NonNullable<NonNullable<ShardContext['game']['runtime']>['play']>['animals'];
type Animal = ReturnType<Animals['spawn']>;
/** One kept home: its declared row's place, the creature living there now and the seconds left before it refills. */
export interface RuntimeHome {
  readonly id: string; readonly kind: string; readonly x: number; readonly z: number; readonly yaw: number; readonly respawn: number;
  animal: Animal | null; wait: number;
}
/** What a runtime lends its declared homes. */
export interface RuntimeHomePorts {
  /** The keeper's update system id (the runtime's tests and captures find it by name). */
  readonly system: string;
  /** Decision-bound homes retain their declared actor ids on standalone pages and refills. */
  readonly decisionActors?: readonly string[];
  /** Each fresh body once spawned (the runtime's look on it). */
  readonly spawned?: (animal: Animal) => void;
  /** Actual homes by declared body address; the existing admitted authority owns their policy binding. */
  readonly bodyHomes?: { readonly rows: readonly { readonly id: string; readonly home: { readonly x: number; readonly y: number; readonly z: number; readonly r: number } }[];
    readonly authority: { home: (kind: string, actor: Animal, at: { readonly x: number; readonly y: number; readonly z: number; readonly r: number }) => void } | null };
  /** Ordered numeric memory holds at the original page update phase, read from the owner's existing flags. */
  readonly holds?: { readonly system: string; readonly rows: readonly { readonly home: number; readonly field: string; readonly until: string }[]; readonly flags: Pick<Flags, 'has'> | null };
  /**
   * One-shot bodies the runtime holds (`runtime.spawns.actors` and bosses whose encounter holds a body; Sky Reach): each
   * spawned once under its runtime-allocated identity, in `order` (the shipping allocation order), then `dress`ed. A
   * `late` body stands on a world floor (its spawn ray starts at `fromY`) and follows every other: standalone on the first
   * `settle` fixed step, once physics has its floor; in a retained home at once, at its exact `y` (restore runs before any
   * tick). The headless home keeper's `late` homes are the same rows.
   */
  readonly held?: { readonly order: readonly string[]; readonly settle: string; readonly dress?: (animal: NonNullable<Animal>, id: string) => void;
    readonly late?: (id: string) => { readonly fromY: number; readonly y: number } | undefined;
    /** Authored late floor placements; absent retains the callback contract. */
    readonly placements?: readonly { readonly id: string; readonly fromY: number; readonly y: number }[] };
}
/** The existing page manager allocates a home identity and replaces its retired body. */
export function spawnRuntimeHome(animals: Pick<Animals, 'spawn' | 'replace'>, home: RuntimeHome, variant: string | undefined, retained: boolean, decisionActors: readonly string[] = []): Animal {
  return spawnPageHome(animals, home, variant, retained, decisionActors);
}
/** The declared homes as kept: every home, every creature alive in one, and each held body by its row id. */
export interface RuntimeHomes { readonly homes: readonly RuntimeHome[]; readonly all: () => Animal[]; readonly held: (id: string) => Animal | null }

/**
 * Keep the declared homes (`runtime.spawns.homes`) in the runtime's play scope: one creature of the row's runtime species
 * per home, refilled `respawn` seconds after it dies. In a retained home (a grid cell) each creature carries its row's id
 * as its identity, and a refill replaces the retired body under that identity (fresh rig, health and ordinary AI state);
 * a portable cold restore that reapplies a dead body without replaying its death starts the authored delay. Standalone
 * spawns allocate ordinary identities, as before. Every body retires with the scope.
 */
export function bindRuntimeHomes(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, ports: RuntimeHomePorts): RuntimeHomes;
/** Construct the same roster in allocation order, yielding between bodies before publishing the completed keeper. */
export function bindRuntimeHomes(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, ports: RuntimeHomePorts, pause: () => Promise<void>): Promise<RuntimeHomes>;
export function bindRuntimeHomes(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, ports: RuntimeHomePorts, pause?: () => Promise<void>): RuntimeHomes | Promise<RuntimeHomes> {
  const rows = runtimeSpawnRows(source);
  return pause === undefined ? bindPageHomes(ctx, rows, ports) : bindPageHomes(ctx, rows, ports, pause);
}

/** A declared boss body (`runtime.spawns.bosses`): the runtime's encounter script spawns and retires it. */
export interface RuntimeBoss {
  readonly row: RuntimeBossRow;
  /** A fresh body: under the row's identity in a retained home, replacing `retired` (a retry) when given. */
  readonly spawn: (retired?: Animal) => Animal | null;
  readonly retire: (animal: Animal) => void;
}
/** Boss identity policy for a runtime adopting spawn data without changing its existing save identities. */
export interface RuntimeBossOptions {
  /** Default: the row id in retained homes. `runtime` keeps ordinary allocation order and runtime ids. */
  readonly identity?: 'declared' | 'runtime';
}
/** Bind one declared boss row to the runtime's animals; `spawned` dresses each fresh body. */
export function bindRuntimeBoss(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, id: string, spawned?: (animal: Animal) => void, options: RuntimeBossOptions = {}): RuntimeBoss {
  return bindPageBoss(ctx, runtimeSpawnRows(source), id, spawned, options);
}

/** A finite declared body, without home refill or encounter behaviour. Placement timing remains runtime-owned. */
export interface RuntimeActor {
  readonly row: RuntimeActorRow;
  /** The caller may lend native floor/altitude placement; identity follows the binder's policy. */
  readonly spawn: (placement?: { readonly y?: number; readonly fromY?: number }) => Animal | null;
  readonly retire: (animal: Animal) => void;
}
/**
 * Bind one `runtime.spawns.actors` row. Default retained identities are declared; `identity: runtime` preserves the
 * runtime's native allocation order for existing saves. The caller owns when to spawn and retire, with no refill.
 */
export function bindRuntimeActor(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, id: string,
  spawned?: (animal: Animal) => void, options: RuntimeBossOptions = {}): RuntimeActor {
  return bindPageActor(ctx, runtimeSpawnRows(source), id, spawned, options);
}

type BuildEquipment = NonNullable<NonNullable<ShardContext['game']['runtime']>['buildEquipment']>;
/** Existing equipment constructors run in declared order, with optional awaited
 * preparation and pauses. A single held item and a full ranged kit use one path.
 */
export function runtimeEquipment(steps: readonly {
  readonly slot: 'primary' | 'rifle' | 'secondary';
  readonly prepare?: (due: () => Promise<void> | null) => Promise<void>;
  readonly create: (...args: Parameters<BuildEquipment>) => Awaited<ReturnType<BuildEquipment>>['primary'];
}[], options: { readonly pause?: () => Promise<void>; readonly slice?: () => () => Promise<void> | null; readonly bind?: (weapons: Awaited<ReturnType<BuildEquipment>>) => void } = {}): BuildEquipment {
  if (steps.length === 0 || steps.length > 3 || !steps.some(step => step.slot === 'primary') ||
    new Set(steps.map(step => step.slot)).size !== steps.length) throw new Error('Invalid runtime equipment slots');
  return async (...args) => {
    const due = options.slice?.() ?? (() => null);
    const weapons: { primary: Awaited<ReturnType<BuildEquipment>>['primary'] | null; rifle: Awaited<ReturnType<BuildEquipment>>['rifle']; secondary: Awaited<ReturnType<BuildEquipment>>['secondary'] } = { primary: null, rifle: null, secondary: null };
    for (const [index, step] of steps.entries()) {
      if (step.prepare !== undefined) { await step.prepare(due); if (options.pause !== undefined) await options.pause(); }
      weapons[step.slot] = step.create(...args);
      if (index + 1 < steps.length && options.pause !== undefined) await options.pause();
    }
    const primary = weapons.primary;
    if (primary === null) throw new Error('Runtime equipment needs its primary');
    const built = { primary, rifle: weapons.rifle, secondary: weapons.secondary };
    options.bind?.(built); return built;
  };
}

/** Adopt already constructed ranged owners into admitted item rows, retaining
 * their original controllers, legacy slots, profiles and optional presentation.
 */
/** JSON text with object keys sorted, so two profiles compare by value: a built product emits canonical key order */
function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${sortedJson(item)}`).join(',')}}`;
  }
  return value === undefined ? 'null' : JSON.stringify(value);
}

/** Compare admitted native profiles by JSON value, independent of wire/schema property order. */
export function sameRuntimeProfile(left: unknown, right: unknown): boolean { return sortedJson(left) === sortedJson(right); }

/** An existing native view/controller factory; item numbers come from the admitted row. */
export interface RuntimeEquipmentFactory {
  readonly prepare?: (due: () => Promise<void> | null) => Promise<void>;
  readonly create: (item: Extract<Shardfile['items']['rows'][number], { kind: 'weapon' }>, ...args: Parameters<BuildEquipment>) => Awaited<ReturnType<BuildEquipment>>['primary'];
}
interface RuntimeEquipmentOwner { readonly id: string; readonly weapon: Awaited<ReturnType<BuildEquipment>>['primary']; readonly profile: unknown; readonly presentation?: boolean }
/** Construct and admit native owners in DATA order, keeping native pickup rows when requested. */
export function bindRuntimeEquipment(ctx: Parameters<typeof bindRuntimeItems>[0], source: Shardfile,
  ports: { readonly factories: ReadonlyMap<string, RuntimeEquipmentFactory> }): BuildEquipment;
export function bindRuntimeEquipment(ctx: Parameters<typeof bindRuntimeItems>[0], source: Shardfile,
  owners: readonly RuntimeEquipmentOwner[]): DeclaredItems;
export function bindRuntimeEquipment(ctx: Parameters<typeof bindRuntimeItems>[0], source: Shardfile,
  input: readonly RuntimeEquipmentOwner[] | { readonly factories: ReadonlyMap<string, RuntimeEquipmentFactory> }): BuildEquipment | DeclaredItems {
  if ('factories' in input) {
    const policy = parseItems(source.items).loadout.runtime;
    if (policy === undefined) throw new Error('Missing runtime equipment factory policy');
    const steps = policy.owners.map(owner => {
      const item = source.items.rows.find(row => row.id === owner.item), factory = input.factories.get(owner.item);
      if (item?.kind !== 'weapon' || factory === undefined) throw new Error('Unresolved runtime equipment factory');
      return { owner, item, factory };
    });
    return async (...args) => {
      const due = policy.sliceMs === undefined ? () => null : slicer(policy.sliceMs).due;
      const owners: RuntimeEquipmentOwner[] = [];
      const kit: { primary: Awaited<ReturnType<BuildEquipment>>['primary'] | null; rifle: Awaited<ReturnType<BuildEquipment>>['rifle']; secondary: Awaited<ReturnType<BuildEquipment>>['secondary'] } = { primary: null, rifle: null, secondary: null };
      for (const [index, { owner, item, factory }] of steps.entries()) {
        if (factory.prepare !== undefined) { await factory.prepare(due); if (policy.pause) await macrotask(); }
        const weapon = factory.create(item, ...args);
        owners.push({ id: item.id, weapon, profile: item.profile, ...(owner.presentation === undefined ? {} : { presentation: owner.presentation }) });
        if (owner.slot !== 'extra') kit[owner.slot] = weapon;
        if (index + 1 < steps.length && policy.pause) await macrotask();
      }
      const bound = bindRuntimeEquipment(ctx, source, owners);
      if (kit.primary === null || bound.primary !== kit.primary) throw new Error('Runtime equipment requires its declared primary first');
      return { primary: kit.primary, rifle: kit.rifle, secondary: kit.secondary,
        extras: owners.filter(owner => owner.weapon !== kit.primary && owner.weapon !== kit.rifle && owner.weapon !== kit.secondary).map(owner => owner.weapon) };
    };
  }
  const owners = input;
  if (owners.length === 0 || owners.length > 16 || new Set(owners.map(owner => owner.id)).size !== owners.length) throw new Error('Invalid runtime item owners');
  const entries = owners.map(owner => {
    const declaration = source.items.rows.find(row => row.id === owner.id), native = owner.weapon.row;
    if (declaration?.kind !== 'weapon' || !sameRuntimeProfile(declaration.profile, owner.profile)) throw new Error('Runtime item profile differs from its constructed owner');
    const { name: _name, icon: _icon, inputContext: _context, swapIcon: _swap, ...ui } = native.ui;
    const presentation: ItemFamilyPresentation = { ui, ...(native.cues === undefined ? {} : { cues: native.cues }),
      ...(native.hitStop === undefined ? {} : { hitStop: native.hitStop }), ...(native.rangedFeel === undefined ? {} : { rangedFeel: native.rangedFeel }) };
    return { owner, declaration, native, presentation };
  });
  const families = new Map<string, ItemFamily>();
  for (const { declaration } of entries) families.set(declaration.family, { kind: 'weapon', profiles: entries.filter(entry => entry.declaration.family === declaration.family)
    .flatMap(entry => entry.declaration.profile === undefined ? [] : [entry.declaration.profile.family]), create: (row, _spec, ports) => {
      const entry = entries.find(value => value.owner.id === row.id);
      if (entry === undefined || !sameRuntimeProfile(ports.profile, entry.owner.profile)) throw new Error('Unbound runtime item profile');
      const { weapon } = entry.owner;
      if (source.items.loadout.runtime?.owners.find(owner => owner.item === entry.owner.id)?.row !== 'native') weapon.row = entry.owner.presentation === true ? { ...entry.presentation, ...row, ui: { ...row.ui, ...entry.presentation.ui }, legacySlot: weapon.id, meta: entry.native.meta }
        : { ...row, legacySlot: weapon.id, meta: entry.native.meta };
      return weapon;
    } });
  // A sole family can lend presentation before row construction (the bow path).
  for (const [name, family] of families) {
    const matches = entries.filter(entry => entry.declaration.family === name), first = matches[0];
    if (matches.length === 1 && first !== undefined) family.presentation = first.presentation;
  }
  return bindRuntimeItems(ctx, source, { families: new Map(), kit: families, icon: name => {
    const entry = entries.find(value => value.native.ui.icon === name); if (entry === undefined) throw new Error('Unknown runtime item icon'); return entry.native.ui.icon;
  } });
}
