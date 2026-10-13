import * as v from 'valibot';
import { MeleeContactsSchema, NativeMeleeRowSchema, WeaponProfileSchema, type MeleeContactRow } from './weaponProfiles';
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
const secondary = v.strictObject({ action: name, code: v.picklist([3, 4]), move: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(15)) });
const weapon = v.strictObject({ id: weaponId, kind: v.literal('weapon'), family: name, slot, context: name, ui, view, hook,
  profile: v.exactOptional(WeaponProfileSchema), contacts: v.exactOptional(MeleeContactsSchema),
  secondary: v.exactOptional(secondary), native: v.exactOptional(NativeMeleeRowSchema),
  light: attack, heavy: attack, charge: v.pipe(duration, v.maxValue(5)) });
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
/** Admit an item's JSON-only contacts without copying its original event-lifetime tag arrays. */
export function parseMeleeContacts(input: unknown): readonly MeleeContactRow[] {
  v.assert(v.custom(isJsonData, 'JSON-only melee contacts'), input);
  v.assert(MeleeContactsSchema, input);
  return input;
}
/** Admit a native owner together with its contacts, preserving event-lifetime arrays.
 * JSON-only policies must resolve every action to the correct contact phase and lane. */
export function parseNativeMeleeBinding(input: unknown, contactsInput: unknown): {
  native: v.InferOutput<typeof NativeMeleeRowSchema>; contacts: readonly MeleeContactRow[];
} {
  v.assert(v.custom(isJsonData, 'JSON-only native melee policy'), input);
  const native = v.parse(NativeMeleeRowSchema, input), contacts = parseMeleeContacts(contactsInput);
  if (native.actions.some(action => {
    const contact = contacts[action.move];
    return contact === undefined || (native.mode === 'timed') !== (contact.lands.length > 0)
      || action.hook !== null && contact.lane !== 'secondary';
  })) throw new TypeError('Native melee action does not match its admitted contact');
  return { native, contacts };
}
/** Declared item families, numeric contacts, input contexts, script hooks and initial loadout. */
export type ShardItems = v.InferOutput<typeof raw>;
/** Local references plus optional script catalogue checks; global format composition supplies admitted module ids. */
export function itemRules(items: ShardItems, modules?: readonly string[]): string[] {
  const errors: string[] = [], ids = items.rows.map((r) => r.id), weapons = items.rows.filter((r) => r.kind === 'weapon');
  const runtimeContexts = items.runtimeContexts ?? [];
  if (weapons.some(row => row.profile !== undefined && !row.family.includes('.') && row.family !== row.profile.family && !(row.family === 'swept' && row.profile.family === 'melee'))) errors.push('weapon profile matches declared family');
  if (weapons.some(row => row.secondary !== undefined && (row.hook === null
    || row.contacts?.[row.secondary.move]?.lane !== 'secondary'))) errors.push('scripted secondary references an admitted hook and secondary contact');
  if (weapons.some(row => row.native !== undefined && (row.contacts === undefined || row.native.actions.some(action => {
    const contact = row.contacts?.[action.move];
    return contact === undefined || (row.native?.mode === 'timed') !== (contact.lands.length > 0)
      || action.hook !== null && (row.hook === null || row.secondary?.code !== action.hook || row.secondary.move !== action.move);
  })))) errors.push('native melee actions resolve admitted contacts and script hooks');
  const nativeSteps = weapons.flatMap(row => row.native === undefined ? [] : [row.native.step]);
  if (new Set(nativeSteps).size !== nativeSteps.length) errors.push('unique native melee steps');
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
const items = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only items'), raw, v.check((data) => itemRules(data).length === 0, 'valid item references'));
/** JSON-only admission rejects closures before serialisation and checks all item/loadout references.
 * The named output bounds root-schema inference; pipe identities remain available to the JSON Schema bridge. */
export const ItemsSchema: v.GenericSchema<unknown, ShardItems> & Pick<typeof items, 'pipe'> = items;
/** Validate authored item rows at both SDK and browser boundaries. */
export function parseItems(input: unknown): ShardItems { return v.parse(ItemsSchema, input); }
