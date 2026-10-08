import * as v from 'valibot';
import { isJsonData } from './json';
import { ItemRuntime, type ItemPorts } from '@wildshard/engine/combat/items';
import type { ItemFamily } from '@wildshard/engine/combat/itemFamilies';
import type { EquipmentIcon, EquipmentRow, WeaponId } from '@wildshard/engine/combat/Equipment';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { Tool } from '@wildshard/engine/combat/Tool';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { AimCommand } from '@wildshard/engine/input/commands';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ScriptEntity } from '@wildshard/engine/script/effects';

const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));const weaponId = v.custom<`weapon.${string}`>((value) => typeof value === 'string' && /^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const toolId = v.custom<`tool.${string}`>((value) => typeof value === 'string' && /^tool\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const slot = v.custom<`declared.weapon.${string}`>((value) => typeof value === 'string' && /^declared\.weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const duration = v.pipe(finite, v.minValue(0.001), v.maxValue(86400));
const vector = v.tuple([v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10))]);
const tag = v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value) && value.length <= 128);
const effect = v.custom<`effect.${string}`>((value) => typeof value === 'string' && /^effect\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const hook = v.nullable(v.strictObject({ module: v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u)), entity: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), event: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)) }));
const view = v.strictObject({ recipe: name, colour: v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u)), position: vector, rotation: vector });
const ui = v.strictObject({ name: text, icon: name, swapIcon: v.pipe(text, v.maxLength(512)), blurb: text });
const attack = v.strictObject({ id: name, damage: v.pipe(finite, v.minValue(0), v.maxValue(10000)), cooldown: duration,
  range: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), width: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), tags: v.pipe(v.array(tag), v.maxLength(32)), effect: v.nullable(effect) });
const weapon = v.strictObject({ id: weaponId, kind: v.literal('weapon'), family: name, slot, context: name, ui, view, hook,
  light: attack, heavy: attack, charge: v.pipe(duration, v.maxValue(5)) });
const tool = v.strictObject({ id: toolId, kind: v.literal('tool'), family: name, ui, view, hook, action: v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value)),
  fuelSeconds: duration, intensity: v.pipe(finite, v.minValue(0), v.maxValue(10)) });
const context = v.variant('keysFrom', [
  v.strictObject({ id: name, keysFrom: v.literal('weapon.melee'), actions: v.tuple([v.literal('attack'), v.literal('heavy'), v.literal('lock')]), touch: v.literal('melee'), lockable: v.boolean() }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.ranged'), actions: v.tuple([v.literal('attack'), v.literal('aim'), v.literal('reload')]), touch: v.literal('ranged'), lockable: v.boolean() }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.bow'), actions: v.tuple([v.literal('attack'), v.literal('aim')]), touch: v.literal('bow'), lockable: v.boolean() }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.spear'), actions: v.tuple([v.literal('attack'), v.literal('aim')]), touch: v.literal('throwing'), lockable: v.boolean() }),
]);
const baselineContexts = new Set(['weapon.melee', 'weapon.ranged', 'weapon.bow', 'weapon.spear']);
const raw = v.strictObject({ version: v.literal(1), rows: v.pipe(v.array(v.variant('kind', [weapon, tool])), v.maxLength(64)),
  contexts: v.pipe(v.array(context), v.maxLength(64)),
  runtimeContexts: v.exactOptional(v.pipe(v.array(name), v.maxLength(64))),
  loadout: v.strictObject({ primary: v.nullable(weaponId), secondary: v.nullable(weaponId), tools: v.pipe(v.array(toolId), v.maxLength(16)) }) });
/** Declared item families, numeric contacts, input contexts, script hooks and initial loadout. */
export type ShardItems = v.InferOutput<typeof raw>;
/** Local references plus optional script catalogue checks; global format composition supplies admitted module ids. */
export function itemRules(items: ShardItems, modules?: readonly string[]): string[] {
  const errors: string[] = [], ids = items.rows.map((r) => r.id), weapons = items.rows.filter((r) => r.kind === 'weapon');
  const runtimeContexts = items.runtimeContexts ?? [];
  if (items.contexts.some((ctx) => baselineContexts.has(ctx.id))) errors.push('baseline context is referenced rather than redeclared');
  if (new Set(runtimeContexts).size !== runtimeContexts.length || runtimeContexts.some((id) => items.contexts.some((ctx) => ctx.id === id))) errors.push('unique runtime context references separate from declared contexts');
  if (new Set(ids).size !== ids.length || new Set(weapons.map((r) => r.slot)).size !== weapons.length
    || new Set(items.contexts.map((r) => r.id)).size !== items.contexts.length) errors.push('unique item ids slots and contexts');
  if (weapons.some((r) => r.slot !== `declared.${r.id}`)) errors.push('stable weapon slot');
  if (weapons.some((r) => r.context !== 'weapon.melee' && !runtimeContexts.includes(r.context) && !items.contexts.some((c) => c.id === r.context))) errors.push('declared weapon context');
  for (const id of [items.loadout.primary, items.loadout.secondary]) if (id !== null && !weapons.some((r) => r.id === id)) errors.push('weapon loadout reference');
  if (items.rows.length > 0 && items.loadout.primary === null) errors.push('primary weapon required');
  if (items.loadout.primary !== null && items.loadout.primary === items.loadout.secondary) errors.push('distinct loadout weapons');
  if (new Set(items.loadout.tools).size !== items.loadout.tools.length || items.loadout.tools.some((id) => !items.rows.some((r) => r.kind === 'tool' && r.id === id))) errors.push('tool loadout reference');
  const handles = items.rows.flatMap((r) => r.hook === null ? [] : [r.hook.entity]);
  if (new Set(handles).size !== handles.length) errors.push('unique item script handles');
  if (modules !== undefined && items.rows.some((r) => r.hook !== null && !modules.includes(r.hook.module))) errors.push('item script module declared');
  return [...new Set(errors)];
}
/** JSON-only admission rejects closures before serialisation and checks all item/loadout references. */
export const ItemsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only items'), raw, v.check((data) => itemRules(data).length === 0, 'valid item references'));
/** Validate authored item rows at both SDK and browser boundaries. */
export function parseItems(input: unknown): ShardItems { return v.parse(ItemsSchema, input); }
/** Build trusted item-handle aliases for the one script lane; actor identity comes from the host session. */
export function declaredItemScriptEntities(input: unknown, actorId: string): { entities: readonly ScriptEntity[]; actors: ReadonlyMap<number, string> } {
  if (actorId.length === 0) throw new Error('Item owner required');
  const items = parseItems(input), entities: ScriptEntity[] = [];
  const actors = new Map<number, string>();
  for (const row of items.rows) if (row.hook !== null) {
    entities.push({ id: row.hook.entity, name: row.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true });
    actors.set(row.hook.entity, actorId);
  }
  return { entities, actors };
}
/** Trusted loader dependencies; factories and icons are resolved below the game layer. */
export interface DeclaredItemPorts {
  scope: Scope; actorId: string; input: Pick<InputService, 'bind' | 'held' | 'register' | 'has'>; aim: () => AimCommand;
  families: ReadonlyMap<string, ItemFamily>; icon: (name: string) => EquipmentIcon;
  runtime: (row: ShardItems['rows'][number]) => ItemPorts;
  /** A trusted shard's own families (M3): each named `<slug>.<name>`, never shadowing a kit family; resolved like the kit's. */
  shardFamilies?: { readonly slug: string; readonly families: ReadonlyMap<string, ItemFamily> };
  /** `runtime`: a hybrid runtime registers the declared input contexts through its own entered-input path (hybridRows.ts). */
  contexts?: 'install' | 'runtime';
}
/** Merge a trusted shard's own item families over the kit's, refusing a foreign or shadowing name. */
export function shardItemFamilies(kit: ReadonlyMap<string, ItemFamily>, shard: NonNullable<DeclaredItemPorts['shardFamilies']>): ReadonlyMap<string, ItemFamily> {
  if (!/^[a-z][a-z0-9-]*$/u.test(shard.slug)) throw new Error('Shard item families need a shard slug');
  const merged = new Map(kit);
  for (const [id, family] of shard.families) {
    if (!id.startsWith(`${shard.slug}.`) || id.length <= shard.slug.length + 1 || !v.is(name, id)) throw new Error(`Shard item family ${id} must be named ${shard.slug}.<name>`);
    if (merged.has(id)) throw new Error(`Shard item family ${id} shadows a registered family`);
    merged.set(id, family);
  }
  return merged;
}
/** Normal equipment factory result plus authoritative fixed-step runtimes, scoped to the one session. */
export interface DeclaredItems {
  primary: Weapon | null; secondary: Weapon | null; extras: readonly Weapon[]; tools: readonly Tool[]; order: readonly WeaponId[];
  runtimes: ReadonlyMap<string, ItemRuntime>; install: (equipment: EquipmentService) => void; step: (tick: number, dt: number) => void;
}
/** Resolve every family before construction, register baseline contexts, and expose the normal buildEquipment handoff. */
export function installDeclaredItems(input: unknown, ports: DeclaredItemPorts): DeclaredItems {
  const data = parseItems(input);
  const runtimeContexts = data.runtimeContexts ?? [];
  if (runtimeContexts.length > 0 && ports.contexts !== 'runtime') throw new Error('Existing runtime input contexts require a runtime-owned items installer');
  for (const id of runtimeContexts) if (!ports.input.has(id)) throw new Error(`Unresolved runtime input context ${id}`);
  const resolved = ports.shardFamilies === undefined ? ports.families : shardItemFamilies(ports.families, ports.shardFamilies);
  const families = data.rows.map((row) => { const family = resolved.get(row.family); if (family?.kind !== row.kind) throw new Error(`Unresolved item family ${row.family}`); return family; });
  const icons = data.rows.map((row) => ports.icon(row.ui.icon));
  const runtimePorts = data.rows.map((row) => {
    const deps = ports.runtime(row);
    if (deps.actor.id !== ports.actorId) throw new Error('Item actor must be host-bound');
    if (row.hook !== null && deps.hook === null) throw new Error('Missing admitted item hook');
    return deps;
  });
  const scope = ports.scope.child('declared-items');
  const weapons = new Map<string, Weapon>(), tools = new Map<string, Tool>(), runtimes = new Map<string, ItemRuntime>();
  try {
    if (ports.contexts !== 'runtime') for (const ctx of data.contexts) ports.input.register({ id: ctx.id, actions: ctx.actions, keysFrom: ctx.keysFrom, touch: { mode: ctx.touch, lockable: ctx.lockable, relabel: {} } }, scope);
    for (const [index, declaration] of data.rows.entries()) {
      const family = families[index], icon = icons[index]; if (family === undefined || icon === undefined) throw new Error('Missing resolved item');
      const deps = runtimePorts[index]; if (deps === undefined) throw new Error('Missing resolved runtime');
      const itemScope = scope.child(declaration.id);
      const runtime = new ItemRuntime(declaration, { ...deps, active: () => !itemScope.disposed && (deps.active?.() ?? true) }); runtimes.set(declaration.id, runtime);
      const { ui: presentationUi, ...presentation } = family.presentation ?? {};
      const row: EquipmentRow = { ...presentation, id: declaration.id, ui: { touch: 'melee', lockOn: declaration.kind === 'weapon', melee: declaration.kind === 'weapon', tracers: false,
        ...presentationUi, name: declaration.ui.name, icon, swapIcon: declaration.ui.swapIcon,
        ...(declaration.kind === 'weapon' ? { inputContext: declaration.context } : {}) }, meta: { name: declaration.ui.name, icon, blurb: declaration.ui.blurb, category: declaration.kind },
        ...(declaration.kind === 'weapon' ? { legacySlot: declaration.slot } : {}) };
      const args = { scope: itemScope, runtime, input: ports.input, aim: ports.aim, view: declaration.view };
      if (declaration.kind === 'weapon' && family.kind === 'weapon') weapons.set(declaration.id, family.create(row, declaration, args));
      else if (declaration.kind === 'tool' && family.kind === 'tool') {
        const instance = family.create(row, declaration, args); tools.set(declaration.id, instance);
        ports.input.bind(declaration.action, () => { runtime.queue(3); }, itemScope, () => instance.enabled);
      }
    }
    const primary = data.loadout.primary === null ? null : weapons.get(data.loadout.primary) ?? null;
    const secondary = data.loadout.secondary === null ? null : weapons.get(data.loadout.secondary) ?? null;
    return { primary, secondary, extras: [...weapons.values()].filter((w) => w !== primary && w !== secondary), tools: [...tools.values()], order: [...weapons.values()].map((w) => w.id), runtimes,
      install: (equipment) => { for (const w of weapons.values()) equipment.unlock(w.id); for (const id of data.loadout.tools) { const t = tools.get(id); if (t !== undefined) equipment.add(t, { locked: false }); } },
      step: (tick, dt) => { if (!scope.disposed) for (const runtime of runtimes.values()) runtime.step(tick, dt); } };
  } catch (error) { scope.dispose(); throw error; }
}
