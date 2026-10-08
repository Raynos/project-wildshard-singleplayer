import { Vector3 } from 'three';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { EquipmentIcon } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import { QuestState, type QuestMarker, type QuestStep } from '@wildshard/engine/quest/core';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShardContext } from '../shard/context';
import { installEnteredRuntimeInput, retainsRuntimeServices } from '../shard/retainedHooks';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../ledger';
import { Purse } from '../loot/Purse';
import { installDeclaredItems, type DeclaredItems } from './items';
import type { RuntimeBoundSection } from './runtimeBinds';
import type { RuntimeBossRow, RuntimeHomeRow } from './runtimeSpawns';
import type { Shardfile } from './schema';

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

/** The source as the data client installs it: every runtime-bound section emptied, so neither installs it twice. */
export function withoutRuntimeRows(source: Shardfile): Shardfile {
  const binds = runtimeBinds(source);
  if (binds.size === 0) return source;
  return { ...source,
    ...(binds.has('quests') ? { quests: { flags: [], quests: [], triggers: [], dialogue: [] } } : {}),
    ...(binds.has('ledger') ? { ledger: [] } : {}),
    ...(binds.has('items') ? { items: { version: 1, rows: [], contexts: [], loadout: { primary: null, secondary: null, tools: [] } } } : {}),
  };
}

/** Emit one declared fact for an entity; the platform ledger decides the grant. */
export type RuntimeFacts = (name: string, entity: string) => LedgerReceipt;

/**
 * Bind the declared ledger rules for a runtime that has no simulation host: each fact is stamped tick 0 and told apart by
 * its entity, so a replayed or reloaded fact is the same fact and grants nothing twice (SF14). `instance` is the
 * first-party placement id.
 */
export function bindRuntimeLedger(ctx: Pick<ShardContext, 'app'>, source: Shardfile, instance: string): RuntimeFacts {
  requireBound(source, 'ledger');
  const identity = { instance, shard: source.identity.slug, revision: source.identity.revision };
  const ledger = new Ledger(ctx.app.saves, [{ id: instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], []);
  return (name, entity) => {
    const rule = source.ledger.find((row) => row.fact === name);
    if (rule === undefined) throw new Error(`Undeclared ledger fact ${name}`);
    return new LedgerEmitter(ledger, { ...identity }, rule.origin, () => 0, []).emit(name, entity);
  };
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
}

/**
 * Install the declared item rows inside a runtime's `buildEquipment`. A runtime-bound row carries no script hook (no
 * simulation lane runs here); a trusted family owns its contacts, so the platform item runtime sees no targets.
 */
export function bindRuntimeItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, source: Shardfile, ports: RuntimeItemPorts): DeclaredItems {
  requireBound(source, 'items');
  if (source.items.rows.some((row) => row.hook !== null)) throw new Error('Runtime-bound items cannot carry script hooks');
  const camera = (): NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['game']['camera'] => {
    const world = ctx.game.runtime?.world; if (world === null || world === undefined) throw new Error('Runtime-bound items need the normal world'); return world.game.camera;
  };
  const player = (): NonNullable<ShardContext['app']['player']> => { const actor = ctx.app.player; if (actor === null) throw new Error('Player health has not entered play'); return actor; };
  const actor: Actor = { id: 'actor.player', get tags() { return player().tags; }, get state() { return player().state; }, get attributes() { return player().attributes; }, get alive() { return player().alive; }, applyDamage: (request) => player().applyDamage(request) };
  return installDeclaredItems(source.items, { scope: ctx.scope, actorId: actor.id, input: ctx.app.input, families: ports.kit ?? new Map(), icon: ports.icon,
    shardFamilies: { slug: source.identity.slug, families: ports.families }, contexts: 'runtime',
    aim: () => ({ origin: camera().getWorldPosition(new Vector3()), direction: camera().getWorldDirection(new Vector3()) }),
    runtime: () => ({ actor, combat: ctx.app.combat, active: () => ctx.app.state === 'play', targets: () => [], hook: null,
      effect: (target, effect, from) => { const service = ctx.app.effects; if (service === null) throw new Error('Missing normal effect host'); service.apply(target, effect, from); },
    }),
  });
}

/**
 * Register the declared item input contexts in the runtime's play stage: while its cell is entered for a retained home
 * (registered again on each entry), for the level otherwise.
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
}
/** The declared homes as kept: every home, and every creature alive in one. */
export interface RuntimeHomes { readonly homes: readonly RuntimeHome[]; readonly all: () => Animal[] }

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
  ctx.on('actor.died', ({ actor }) => { const home = homes.find((h) => h.animal?.combatActor() === actor); if (home) home.wait = home.respawn; });
  ctx.system({ id: ports.system, phase: 'update', run: (dt) => {
    for (const home of homes) {
      if (retained && home.animal?.alive === false && home.wait <= 0) home.wait = home.respawn;
      if (home.wait <= 0) continue;
      home.wait -= dt;
      if (home.wait <= 0) { if (home.animal) animals?.retire(home.animal); spawn(home); }
    }
  } });
  ctx.scope.onDispose(() => { for (const home of homes) if (home.animal) animals?.retire(home.animal); });
  return { homes, all: () => homes.flatMap((h) => h.animal ? [h.animal] : []) };
}

/** A declared boss body (`runtime.spawns.bosses`): the runtime's encounter script spawns and retires it. */
export interface RuntimeBoss {
  readonly row: RuntimeBossRow;
  /** A fresh body: under the row's identity in a retained home, replacing `retired` (a retry) when given. */
  readonly spawn: (retired?: Animal) => Animal | null;
  readonly retire: (animal: Animal) => void;
}
/** Bind one declared boss row to the runtime's animals; `spawned` dresses each fresh body. */
export function bindRuntimeBoss(ctx: ShardContext, source: Pick<Shardfile, 'runtime'>, id: string, spawned?: (animal: Animal) => void): RuntimeBoss {
  const row = runtimeSpawnRows(source).bosses.find((boss) => boss.id === id); if (row === undefined) throw new Error(`Undeclared runtime boss ${id}`);
  const animals: Animals | undefined = ctx.game.runtime?.play?.animals, retained = retainsRuntimeServices(ctx), [x, z] = row.at;
  return { row,
    spawn: (retired) => {
      const a = retained && retired !== undefined ? animals?.replace(retired, x, z, row.yaw, row.look, {}) ?? null
        : animals?.spawn(row.kind, x, z, row.yaw, row.look, retained ? { entityId: row.id } : undefined) ?? null;
      if (a) spawned?.(a); return a;
    },
    retire: (a) => { animals?.retire(a); } };
}
