import { Vector3 } from 'three';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { EquipmentIcon } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import { QuestState, type QuestMarker, type QuestStep } from '@wildshard/engine/quest/core';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShardContext } from '../shard/context';
import { installEnteredRuntimeInput, retainsRuntimeServices } from '../shard/retainedHooks';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../ledger';
import { installDeclaredItems, type DeclaredItems } from './items';
import type { RuntimeBoundSection } from './runtimeBinds';
import type { Shardfile } from './schema';

/**
 * The runtime-owner binding (SHARD-PLATFORM M3, E435). A hybrid shard's trusted runtime owns its world and its play scope;
 * the behaviour sections it names in `runtime.binds` stay declared data, and these installers put them into that scope
 * (the entered `runtime:<instance>` scope in a grid cell, the level scope standalone) through the template's own
 * installers: the platform `Ledger`, engine `QuestState`, `installDeclaredItems`. The runtime binds to the result; it never
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

/** What a runtime lends a declared quest: its flags, the built place of a world-piece marker, a chip the format cannot carry yet. */
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
