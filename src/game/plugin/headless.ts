import type { Progress } from "../Progress";
import { Vector3, type Object3D } from 'three';
import { shardContentIdentity, legacyContentIdentity } from "../shard/list";
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { EquipmentIcon, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import { QuestState, type QuestMarker, type QuestStep } from '@wildshard/engine/quest/core';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { type ShardContext, ShardPlugin } from './context';
import { installEnteredRuntimeInput, retainsRuntimeServices } from "../shard/retainedHooks";
import { Ledger, LedgerEmitter, type LedgerReceipt } from "../ledger";
import { Purse } from "../loot/Purse";
import { installDeclaredItems, type DeclaredItems, type DeclaredItemPorts } from "../shardfile/items";
import type { RuntimeBoundSection } from "@wildshard/format/runtimeBinds";
import type { RuntimeActorRow, RuntimeBossRow, RuntimeHomeRow } from "@wildshard/format/runtimeSpawns";
import type { Shardfile } from "@wildshard/format/shardSchema";
import { installRuntimeState, type RuntimeState, type RuntimeStateValue } from "../shardfile/runtimeState";

import { installRuntimeAudio } from "./audio";
import { installRuntimeLoot, type ScopedLoot } from "../loot/runtime";

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
  if (files.size === 0) return files;
  // a file another (unbound) declaration still names stays the data client's
  const unbound = { ...source, terrain: binds.has('terrain') ? null : source.terrain, props: binds.has('props') ? null : source.props, tiles: [], files: [], critical: [], library: [], far: null };
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
  if (binds.has('state') && (source.state.player.length > 0 || source.state.shared.some((field) => field.privacy !== 'host'))) {
    throw new Error('Runtime-bound state supports only host-owned shared fields');
  }
  const world = runtimeBoundWorldFiles(source), keep = (ref: string): boolean => !world.has(ref);
  const far = source.far === null || source.far.files.every(keep) ? source.far : source.far.files.some(keep) ? { ...source.far, files: source.far.files.filter(keep) } : null;
  return { ...source,
    ...(binds.has('terrain') ? { terrain: null } : {}),
    // bound props keep their collider rows (an entry's landings are platform data, like the edges); the drawn content is the runtime's
    ...(binds.has('props') ? { props: withoutDrawnProps(source.props) } : {}),
    ...(world.size === 0 ? {} : { files: source.files.filter((file) => keep(file.hash)), critical: source.critical.filter(keep), library: source.library.filter(keep), far,
      tiles: source.tiles.flatMap((tile) => { const files = tile.files.filter(keep); return files.length === 0 ? [] : [files.length === tile.files.length ? tile : { ...tile, files }]; }) }),
    ...(binds.has('modes') ? { modes: { traverse: [] } } : {}),
    ...(binds.has('clientChannels') ? { clientChannels: [] } : {}),
    ...(binds.has('quests') ? { quests: { flags: [], quests: [], triggers: [], dialogue: [] } } : {}),
    ...(binds.has('ledger') ? { ledger: [] } : {}),
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
  const identity = { instance, shard: source.identity.slug, revision: source.identity.revision };
  const ledger = new Ledger(ctx.app.saves, [{ id: instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], []);
  const emit = (name: string, entity: string): LedgerReceipt => {
    const rule = source.ledger.find((row) => row.fact === name);
    if (rule === undefined) throw new Error(`Undeclared ledger fact ${name}`);
    return new LedgerEmitter(ledger, { ...identity }, rule.origin, () => 0, []).emit(name, entity);
  };
  return Object.assign(emit, { flush: () => ledger.flush(), achievement: (id: string) => {
    const row = ledger.state().achievements[JSON.stringify([identity.shard, id])];
    return row === undefined ? undefined : { count: row.count, earned: row.earned };
  } });
}

/** Project an existing runtime ledger into its caller-owned Progress view. The emitter remains the sole grant/write
 * owner. Each successful or duplicate emission refreshes once; a thrown emission does not refresh. Pending-write
 * retries and achievement reads are the exact original ports, and an absent view installs no presentation. */
export function projectRuntimeFacts(emit: RuntimeFacts, progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined): RuntimeFacts {
  const facts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); progress?.refreshLedger(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  progress?.bindLedger({ count: (id) => facts.achievement(id)?.count ?? 0,
    earned: (id) => facts.achievement(id)?.earned ?? false, checkpoint: facts.flush });
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
  readonly state: QuestState;
  readonly declared: QuestRow;
  readonly reward: { readonly coins: number; readonly fact: string | null };
}

/**
 * Build one declared quest's state over the runtime's flags, scoped to its play scope. The `onComplete` fact is emitted
 * through the bound ledger when the quest completes, and once on bind for a save that finished it before facts existed.
 */
export function bindRuntimeQuest(ctx: Pick<ShardContext, 'app' | 'scope'>, source: Shardfile, id: string, ports: RuntimeQuestPorts): RuntimeQuest {
  requireBound(source, 'quests');
  const declared = source.quests.quests.find((row) => row.id === id);
  if (declared === undefined) throw new Error(`Undeclared quest ${id}`);
  const fact = declared.onComplete?.fact ?? null, facts = ports.facts;
  if (fact !== null && (facts === undefined || !source.ledger.some((rule) => rule.fact === fact))) throw new Error(`Quest ${id} completes with fact ${fact}, which needs the bound ledger`);
  const place = (marker: MarkerRow): QuestMarker => ({ ...marker, at: ports.place?.(marker) ?? marker.at });
  const steps = declared.steps.map((step): QuestStep => {
    const chip = ports.chip?.(step) ?? step.chip;
    return { ...step, ...(chip === undefined ? {} : { chip }), ...(step.markers === undefined ? {} : { markers: step.markers.map(place) }) };
  });
  const intro = declared.intro === undefined ? undefined : { ...declared.intro, ...(declared.intro.markers === undefined ? {} : { markers: declared.intro.markers.map(place) }) };
  const state = new QuestState({ id: declared.id, title: declared.title, completeFlag: declared.completeFlag, steps,
    ...(declared.startWhen === undefined ? {} : { startWhen: declared.startWhen }), ...(intro === undefined ? {} : { intro }) }, ports.flags, ctx.app.events, ctx.scope);
  if (fact !== null && facts !== undefined) {
    const witness = (): void => { facts(fact, declared.id); };
    if (state.isComplete) witness();
    ctx.scope.onDispose(state.observe({ complete: witness }));
  }
  return { state, declared, reward: { coins: declared.onComplete?.coins ?? 0, fact } };
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
  if (source.items.rows.some(row => row.hook !== null && (ports.hooks?.get(row.id) === null || ports.hooks?.get(row.id) === undefined))) throw new Error('Runtime-bound items require their admitted composed hooks');
  const camera = (): NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['game']['camera'] => {
    const world = ctx.game.runtime?.world; if (world === null || world === undefined) throw new Error('Runtime-bound items need the normal world'); return world.game.camera;
  };
  const player = (): NonNullable<ShardContext['app']['player']> => { const actor = ctx.app.player; if (actor === null) throw new Error('Player health has not entered play'); return actor; };
  const actor: Actor = { id: 'actor.player', get tags() { return player().tags; }, get state() { return player().state; }, get attributes() { return player().attributes; }, get alive() { return player().alive; }, applyDamage: (request) => player().applyDamage(request) };
  return installDeclaredItems(source.items, { scope: ctx.scope, actorId: actor.id, input: ctx.app.input, families: ports.kit ?? new Map(), icon: ports.icon,
    shardFamilies: { slug: shardContentIdentity(source.identity.slug), families: ports.families }, contexts: 'runtime',
    aim: () => ({ origin: camera().getWorldPosition(new Vector3()), direction: camera().getWorldDirection(new Vector3()) }),
    runtime: row => ({ actor, combat: ctx.app.combat, active: () => ctx.app.state === 'play', targets: () => [], hook: row.hook === null ? null : ports.hooks?.get(row.id) ?? null,
      effect: (target, effect, from) => { const service = ctx.app.effects; if (service === null) throw new Error('Missing normal effect host'); service.apply(target, effect, from); },
    }),
  });
}

/**
 * Resolve declared item input definitions in the runtime's play stage. Retained homes keep definitions until disposal,
 * with actions enabled and binding descriptions installed only while entered; ordinary levels keep their level scope.
 */
export function bindRuntimeItemContexts(ctx: ShardContext, source: Shardfile): void {
  requireBound(source, 'items');
  for (const row of source.items.contexts) {
    const definition = { id: row.id, actions: row.actions, keysFrom: row.keysFrom, touch: { mode: row.touch, lockable: row.lockable, relabel: {} } };
    if (retainsRuntimeServices(ctx)) installEnteredRuntimeInput(ctx, definition, { rows: [] });
    else ctx.inputContext(definition);
  }
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
  /** Each fresh body once spawned (the runtime's look on it). */
  readonly spawned?: (animal: Animal) => void;
  /**
   * One-shot bodies the runtime holds (`runtime.spawns.actors` and bosses whose encounter holds a body; Sky Reach): each
   * spawned once under its runtime-allocated identity, in `order` (the shipping allocation order), then `dress`ed. A
   * `late` body stands on a world floor (its spawn ray starts at `fromY`) and follows every other: standalone on the first
   * `settle` fixed step, once physics has its floor; in a retained home at once, at its exact `y` (restore runs before any
   * tick). The headless home keeper's `late` homes are the same rows.
   */
  readonly held?: { readonly order: readonly string[]; readonly settle: string; readonly dress?: (animal: NonNullable<Animal>, id: string) => void;
    readonly late?: (id: string) => { readonly fromY: number; readonly y: number } | undefined };
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
export function bindRuntimeHomes(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, ports: RuntimeHomePorts): RuntimeHomes {
  const rows = runtimeSpawnRows(source).homes, animals: Animals | undefined = ctx.game.runtime?.play?.animals, retained = retainsRuntimeServices(ctx);
  const homes: RuntimeHome[] = rows.map((row: RuntimeHomeRow) => ({ id: row.id, kind: row.kind, x: row.at[0], z: row.at[1], yaw: row.yaw, respawn: row.respawn, animal: null, wait: 0 }));
  const look = new Map(rows.map((row) => [row.id, row.look]));
  const spawn = (home: RuntimeHome): void => {
    const variant = look.get(home.id);
    home.animal = retained && home.animal !== null
      ? animals?.replace(home.animal, home.x, home.z, home.yaw, variant, {}) ?? null
      : animals?.spawn(home.kind, home.x, home.z, home.yaw, variant, retained ? { entityId: home.id } : undefined) ?? null;
    home.wait = 0;
    if (home.animal) ports.spawned?.(home.animal);
  };
  for (const home of homes) spawn(home);
  if (homes.length > 0) {
    ctx.on('actor.died', ({ actor }) => { const home = homes.find((h) => h.animal?.combatActor() === actor); if (home) home.wait = home.respawn; });
    ctx.system({ id: ports.system, phase: 'update', run: (dt) => {
      for (const home of homes) {
        if (retained && home.animal?.alive === false && home.wait <= 0) home.wait = home.respawn;
        if (home.wait <= 0) continue;
        home.wait -= dt;
        if (home.wait <= 0) { if (home.animal) animals?.retire(home.animal); spawn(home); }
      }
    } });
  }
  const held = holdBodies(ctx, source, ports.held, retained);
  ctx.scope.onDispose(() => { for (const home of homes) if (home.animal) animals?.retire(home.animal); for (const body of held.values()) animals?.retire(body); });
  return { homes, all: () => homes.flatMap((h) => h.animal ? [h.animal] : []), held: (id) => held.get(id) ?? null };
}

/** Spawn the runtime's held one-shot bodies (`RuntimeHomePorts.held`): the early ones now, the late ones after them. */
function holdBodies(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, hold: RuntimeHomePorts['held'], retained: boolean): Map<string, NonNullable<Animal>> {
  const held = new Map<string, NonNullable<Animal>>(); if (hold === undefined) return held;
  const bosses = new Set(runtimeSpawnRows(source).bosses.map((row) => row.id)), native = { identity: 'runtime' } as const;
  const land = (id: string, placement?: { readonly y?: number; readonly fromY?: number }): void => {
    const animal = bosses.has(id) ? bindRuntimeBoss(ctx, source, id, undefined, native).spawn() : bindRuntimeActor(ctx, source, id, undefined, native).spawn(placement);
    if (animal) { held.set(id, animal); hold.dress?.(animal, id); }
  };
  const late = hold.order.flatMap((id) => { const at = hold.late?.(id); return at === undefined ? [] : [{ id, at }]; });
  for (const id of hold.order) if (!late.some((row) => row.id === id)) land(id);
  let due = !retained;
  ctx.system({ id: hold.settle, phase: 'fixed.post', run: () => { if (!due) return; due = false; for (const row of late) land(row.id, { fromY: row.at.fromY }); } });
  if (retained) for (const row of late) land(row.id, { y: row.at.y });
  return held;
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
  const row = runtimeSpawnRows(source).bosses.find((boss) => boss.id === id); if (row === undefined) throw new Error(`Undeclared runtime boss ${id}`);
  const animals: Animals | undefined = ctx.game.runtime?.play?.animals, retained = retainsRuntimeServices(ctx) && options.identity !== 'runtime', [x, z] = row.at;
  return { row,
    spawn: (retired) => {
      const a = retained && retired !== undefined ? animals?.replace(retired, x, z, row.yaw, row.look, {}) ?? null
        : animals?.spawn(row.kind, x, z, row.yaw, row.look, retained ? { entityId: row.id } : undefined) ?? null;
      if (a) spawned?.(a); return a;
    },
    retire: (a) => { animals?.retire(a); } };
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
  const row = runtimeSpawnRows(source).actors?.find((actor) => actor.id === id);
  if (row === undefined) throw new Error(`Undeclared runtime actor ${id}`);
  const animals: Animals | undefined = ctx.game.runtime?.play?.animals, retained = retainsRuntimeServices(ctx) && options.identity !== 'runtime';
  return { row, spawn: (placement) => {
    const animal = animals?.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { ...placement, ...(retained ? { entityId: row.id } : {}) }) ?? null;
    if (animal !== null) spawned?.(animal);
    return animal;
  }, retire: (animal) => { animals?.retire(animal); } };
}

type InputDefinition = Parameters<ShardContext['inputContext']>[0];
type BuildEquipment = NonNullable<NonNullable<ShardContext['game']['runtime']>['buildEquipment']>;
type AnimalBody = NonNullable<Animal>;
/** The combat targets `buildEquipment` lends a hybrid runtime's weapon. */
export type HybridTargets = Parameters<BuildEquipment>[0];
type InputDescription = Parameters<ShardContext['app']['input']['bindings']['describe']>[0];
/** What a hybrid runtime declares (G345; Signal Dunes and Sky Reach): the host installs it in one fixed order. */
export interface HybridRuntimeRows {
  /** the debug name captures read it under (`__wildshard.shard.<expose>`) */
  readonly expose: string;
  readonly strings: Parameters<ShardContext['strings']>[0];
  /** the held weapon's row: its content row and the cues its swings play */
  readonly weapon: EquipmentRow;
  readonly encounters: Parameters<ShardContext['rows']['encounter']>[0];
  /** the flag the session's quest probe reports once `quest` is complete */
  readonly complete: string;
  readonly audio: Parameters<typeof installRuntimeAudio>[1];
  readonly cues: Parameters<typeof installRuntimeAudio>[2];
  /** Build the brain catalogue (in kit, as the rows enter): the brained species rows, their looks and the live witness. */
  readonly species: () => { readonly rows: Parameters<ShardContext['rows']['species']>[0]; readonly looks: Parameters<ShardContext['rows']['speciesLook']>[0]; readonly witness: (actor: AnimalBody) => string | null };
}
/** A held weapon the host wires: its viewmodel and its swing cues. */
export type HybridWeapon = Awaited<ReturnType<BuildEquipment>>['primary'] & { onSwing: ((heavy: boolean) => void) | null; readonly model: Object3D };

/**
 * The shared host of a hybrid shard's trusted plugin (G345). The shard declares `rows` and keeps only what genuinely
 * differs in its hooks; the host runs every stage in one order. world: strings, then `build`. kit: the weapon row, the
 * species catalogue (rows, looks), the encounters, `prepare`, then `buildEquipment` (`arm`, with the swing cues wired).
 * play: the weapon into the viewmodel and `dress`, `enter`, the declared audio, the coin loot, `install`, the quest's
 * complete flag (from the `quest` that `install` set), then the debug name.
 */
export abstract class HybridRuntimePlugin extends ShardPlugin {
  protected abstract readonly rows: HybridRuntimeRows;
  /** The player's position when the world has no motor (a renderer-free page). */
  readonly player = new Vector3();
  /** The runtime's quest, once `install` has made it. */
  quest: QuestState | null = null;
  private witness: ((actor: AnimalBody) => string | null) | null = null;
  /** The world, behind the loading screen (after the strings). */
  protected abstract build(ctx: ShardContext): Promise<void> | void;
  /** The primary weapon for `buildEquipment`. */
  protected abstract arm(ctx: ShardContext, targets: HybridTargets): HybridWeapon;
  /** The weapon now built (null before `buildEquipment`). */
  protected abstract armed(): HybridWeapon | null;
  /** The bodies the SF27 activation receipt reports. */
  protected abstract witnessed(): readonly AnimalBody[];
  /** Everything after the loot, in the shard's own order. */
  protected abstract install(ctx: ShardContext, loot: ScopedLoot | null): Promise<void> | void;
  /** Kit work after the rows, before `buildEquipment`. */
  protected prepare(_ctx: ShardContext): void { /* none by default */ }
  /** The weapon's look once it is in the viewmodel (the host takes it out again with the scope). */
  protected dress(_ctx: ShardContext, _weapon: HybridWeapon): void { /* none by default */ }
  /** Play work before the audio. */
  protected enter(_ctx: ShardContext): void { /* none by default */ }

  override async world(ctx: ShardContext): Promise<void> { ctx.strings(this.rows.strings); await this.build(ctx); }
  override kit(ctx: ShardContext): void {
    const rows = this.rows, rt = ctx.game.runtime;
    ctx.rows.weapon(rows.weapon);
    const species = rows.species(); this.witness = species.witness; ctx.rows.species(species.rows); ctx.rows.speciesLook(species.looks);
    ctx.rows.encounter(rows.encounters);
    this.prepare(ctx);
    if (rt) rt.buildEquipment = (targets) => {
      const primary = this.arm(ctx, targets);
      primary.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(rows.weapon, 'heavy'); else rt.play?.cues.fire(rows.weapon); };
      return Promise.resolve({ primary, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override async play(ctx: ShardContext): Promise<void> {
    const host = ctx.app.equipmentHost, weapon = this.armed(), rt = ctx.game.runtime;
    if (host !== null && weapon !== null) { host.viewmodel.add(weapon.model); ctx.scope.onDispose(() => { weapon.model.removeFromParent(); }); this.dress(ctx, weapon); }
    this.enter(ctx);
    installRuntimeAudio(ctx, this.rows.audio, this.rows.cues);
    const loot = installRuntimeLoot(ctx, { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt?.play?.cues.cue('cue.swap'); } });
    await this.install(ctx, loot);
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete === true ? [this.rows.complete] : [];
    ctx.debug.expose(this.rows.expose, this);
  }
  /** Actual instantiated declared policies, for the SF27 activation receipt; no actor state is changed. */
  brainWitness(): { id: string; kind: string; family: string | null }[] {
    return this.witnessed().map(actor => ({ id: actor.entityId, kind: actor.kind, family: this.witness?.(actor) ?? null }));
  }
  /** A runtime's own input definition and key-binding rows: resolved in a retained home, else on the level scope. */
  protected input(ctx: ShardContext, definition: InputDefinition, description: InputDescription): void {
    if (retainsRuntimeServices(ctx)) installEnteredRuntimeInput(ctx, definition, description);
    else { ctx.inputContext(definition); ctx.app.input.bindings.describe(description, ctx.scope); }
  }
}
