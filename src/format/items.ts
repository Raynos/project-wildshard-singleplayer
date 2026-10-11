import * as v from 'valibot';
import { WeaponProfileSchema } from './weaponProfiles';
import { isJsonData } from './json';

/** The bounded authored family/context name, also checked by the trusted family installer. */
export const ItemFamilyNameSchema = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const name = ItemFamilyNameSchema;
const weaponId = v.custom<`weapon.${string}`>((value) => typeof value === 'string' && /^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const toolId = v.custom<`tool.${string}`>((value) => typeof value === 'string' && /^tool\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const slot = v.custom<`declared.weapon.${string}`>((value) => typeof value === 'string' && /^declared\.weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const duration = v.pipe(finite, v.minValue(0.001), v.maxValue(86400));
const vector = v.tuple([v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10))]);
const tag = v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value) && value.length <= 128);
const effect = v.custom<`effect.${string}`>((value) => typeof value === 'string' && /^effect\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const hook = v.nullable(v.strictObject({ module: v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u)), entity: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), event: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)) }));
const view = v.strictObject({ asset: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u))), recipe: name, colour: v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u)), position: vector, rotation: vector });
const ui = v.strictObject({ name: text, icon: name, swapIcon: v.pipe(text, v.maxLength(512)), blurb: text });
const attack = v.strictObject({ id: name, damage: v.pipe(finite, v.minValue(0), v.maxValue(10000)), cooldown: duration,
  range: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), width: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), tags: v.pipe(v.array(tag), v.maxLength(32)), effect: v.nullable(effect) });
const weapon = v.strictObject({ id: weaponId, kind: v.literal('weapon'), family: name, slot, context: name, ui, view, hook,
  profile: v.exactOptional(WeaponProfileSchema), light: attack, heavy: attack, charge: v.pipe(duration, v.maxValue(5)) });
const tool = v.strictObject({ id: toolId, kind: v.literal('tool'), family: name, ui, view, hook, action: v.nullable(v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))),
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
  if (weapons.some(row => row.profile !== undefined && !row.family.includes('.') && row.family !== row.profile.family && !(row.family === 'swept' && row.profile.family === 'melee'))) errors.push('weapon profile matches declared family');
  if (items.rows.some((row) => row.kind === 'tool' && row.action === null && row.hook !== null)) errors.push('native tools have no script hook');
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
