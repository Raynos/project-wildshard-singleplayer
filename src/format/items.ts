import { InputExtraSchema, inputExtraRules } from './inputDeclarations';
import { BodyLaunchSchema, NativeLoadoutRowSchema, NativeRangedRowSchema } from './nativeItems';
import { ClaimedPickupSchema, LootEconomySchema } from './lootEconomy';
import * as v from 'valibot';
import { MeleeContactsSchema, NativeMeleeRowSchema, WeaponProfileSchema, type MeleeContactRow } from './weaponProfiles';
import { isJsonData } from './json';

/** The bounded authored family/context name, also checked by the trusted family installer. */
export const ItemFamilyNameSchema: v.GenericSchema<ItemFamilyNameRowsInput, ItemFamilyNameRows> = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const name = ItemFamilyNameSchema;
const weaponId: v.GenericSchema<`weapon.${string}`> = v.custom<`weapon.${string}`>((value) => typeof value === 'string' && /^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const toolId = v.custom<`tool.${string}`>((value) => typeof value === 'string' && /^tool\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const slot = v.custom<`declared.weapon.${string}`>((value) => typeof value === 'string' && /^declared\.weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value) && value.length <= 128);
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const duration = v.pipe(finite, v.minValue(0.001), v.maxValue(86400));
const vector = v.tuple([v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10)), v.pipe(finite, v.minValue(-10), v.maxValue(10))]);
const tag: v.GenericSchema<`${string}.${string}`> = v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value) && value.length <= 128);
const effect = v.custom<`effect.${string}`>((value) => typeof value === 'string' && /^effect\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const hook = v.nullable(v.strictObject({ module: v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u)), entity: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), event: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)) }));
const view = v.strictObject({ asset: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u))), recipe: name, colour: v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u)), position: vector, rotation: vector });
const ui = v.strictObject({ name: text, icon: name, swapIcon: v.pipe(text, v.maxLength(512)), blurb: text });
const attack: v.StrictObjectSchema<{ readonly id: v.GenericSchema<ItemAttackRowsInput['id'], ItemAttackRows['id']>; readonly damage: v.GenericSchema<ItemAttackRowsInput['damage'], ItemAttackRows['damage']>; readonly cooldown: v.GenericSchema<ItemAttackRowsInput['cooldown'], ItemAttackRows['cooldown']>; readonly range: v.GenericSchema<ItemAttackRowsInput['range'], ItemAttackRows['range']>; readonly width: v.GenericSchema<ItemAttackRowsInput['width'], ItemAttackRows['width']>; readonly tags: v.SchemaWithPipe<readonly [v.ArraySchema<v.GenericSchema<ItemAttackRowsInput['tags'][number], ItemAttackRows['tags'][number]>, undefined>, v.MaxLengthAction<ItemAttackRows['tags'], 32, undefined>]>; readonly effect: v.NullableSchema<v.GenericSchema<Exclude<ItemAttackRowsInput['effect'], null>, Exclude<ItemAttackRows['effect'], null>>, undefined>; }, undefined> = v.strictObject({ id: name, damage: v.pipe(finite, v.minValue(0), v.maxValue(10000)), cooldown: duration,
  range: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), width: v.pipe(finite, v.minValue(0.01), v.maxValue(20)), tags: v.pipe(v.array(tag), v.maxLength(32)), effect: v.nullable(effect) });
const secondary = v.strictObject({ action: name, code: v.exactOptional(v.picklist([3, 4])), move: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(15)) });
/** Portable equipment presentation. World pickups remain owned by their existing service. */
/** Shared catalogue glyph ids; content supplies names, never executable icon hooks. */
export const CatalogueIconSchema: v.GenericSchema<CatalogueIconNameInput, CatalogueIconName> = v.picklist(['lock', 'check', 'poi', 'you', 'map', 'pack', 'star', 'book', 'heart', 'pin', 'laurel',
  'sword', 'deer', 'elk', 'boar', 'bear', 'ghost', 'ironhide', 'meat', 'hide', 'tusk', 'antlers', 'bolt', 'claw', 'shell', 'coconut', 'coin', 'seaglass', 'rope', 'whetstone', 'chart', 'bearclaw', 'boartusk', 'crossbow', 'rifle', 'lever', 'longbow', 'hat', 'cape', 'charm', 'necklace', 'glyph', 'purse', 'talon', 'leopard', 'wolf', 'eagle', 'rider', 'horse', 'grapple']);
const equipmentNumber = v.pipe(finite, v.minValue(0), v.maxValue(10000));
const cue = v.pipe(v.string(), v.regex(/^cue\.[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const equipment: v.StrictObjectSchema<{ readonly id: v.GenericSchema<ItemEquipmentRowsInput['id'], ItemEquipmentRows['id']>; readonly legacySlot: v.ExactOptionalSchema<v.GenericSchema<Exclude<ItemEquipmentRowsInput['legacySlot'], undefined>, Exclude<ItemEquipmentRows['legacySlot'], undefined>>, undefined>; readonly ui: v.GenericSchema<ItemEquipmentRowsInput['ui'], ItemEquipmentRows['ui']>; readonly meta: v.StrictObjectSchema<{ readonly name: v.GenericSchema<ItemEquipmentRowsInput['meta']['name'], ItemEquipmentRows['meta']['name']>; readonly icon: v.GenericSchema<ItemEquipmentRowsInput['meta']['icon'], ItemEquipmentRows['meta']['icon']>; readonly blurb: v.GenericSchema<ItemEquipmentRowsInput['meta']['blurb'], ItemEquipmentRows['meta']['blurb']>; readonly category: v.GenericSchema<ItemEquipmentRowsInput['meta']['category'], ItemEquipmentRows['meta']['category']>; }, undefined>; readonly cues: v.ExactOptionalSchema<v.GenericSchema<Exclude<ItemEquipmentRowsInput['cues'], undefined>, Exclude<ItemEquipmentRows['cues'], undefined>>, undefined>; readonly hitStop: v.ExactOptionalSchema<v.GenericSchema<Exclude<ItemEquipmentRowsInput['hitStop'], undefined>, Exclude<ItemEquipmentRows['hitStop'], undefined>>, undefined>; readonly rangedFeel: v.ExactOptionalSchema<v.GenericSchema<Exclude<ItemEquipmentRowsInput['rangedFeel'], undefined>, Exclude<ItemEquipmentRows['rangedFeel'], undefined>>, undefined>; readonly tags: v.ExactOptionalSchema<v.GenericSchema<Exclude<ItemEquipmentRowsInput['tags'], undefined>, Exclude<ItemEquipmentRows['tags'], undefined>>, undefined>; }, undefined> = v.strictObject({ id: v.pipe(v.string(), v.regex(/^weapon\.[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128)),
  legacySlot: v.exactOptional(v.picklist(['crossbow', 'sword', 'rifle', 'sword-iron', 'bow', 'sabre', 'spear', 'empty'])),
  ui: v.strictObject({ name: text, icon: CatalogueIconSchema, swapIcon: v.pipe(text, v.maxLength(512)),
    touch: v.picklist(['melee', 'bow', 'ranged', 'throwing']), lockOn: v.boolean(), melee: v.boolean(), tracers: v.boolean(),
    inputContext: v.exactOptional(name), swapName: v.exactOptional(text), huntersEye: v.exactOptional(v.boolean()),
    ammo: v.exactOptional(v.strictObject({ label: text, segments: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1024)),
      magazine: v.exactOptional(v.boolean()), bagLabel: v.exactOptional(text), bagLabelFor: v.exactOptional(text) })) }),
  meta: v.strictObject({ name: text, icon: CatalogueIconSchema, blurb: text, category: name }),
  cues: v.exactOptional(v.strictObject({ fire: cue, reload: cue, impact: cue, dry: v.exactOptional(cue), hit: v.exactOptional(cue),
    heavy: v.exactOptional(cue), charge: v.exactOptional(v.record(name, cue)) })),
  hitStop: v.exactOptional(v.strictObject({ body: equipmentNumber, head: equipmentNumber, kill: equipmentNumber })),
  rangedFeel: v.exactOptional(v.strictObject({ kick: v.strictObject({ body: equipmentNumber, head: equipmentNumber, kill: equipmentNumber, side: equipmentNumber, killSide: equipmentNumber }),
    trauma: v.strictObject({ kill: equipmentNumber, head: equipmentNumber, killKinds: v.pipe(v.array(name), v.maxLength(64)), headKinds: v.pipe(v.array(name), v.maxLength(64)) }) })),
  tags: v.exactOptional(v.pipe(v.array(tag), v.maxLength(32))),
});
const weapon: v.StrictObjectSchema<{ readonly id: v.GenericSchema<WeaponItemRowsInput['id'], WeaponItemRows['id']>; readonly kind: v.GenericSchema<WeaponItemRowsInput['kind'], WeaponItemRows['kind']>; readonly family: v.GenericSchema<WeaponItemRowsInput['family'], WeaponItemRows['family']>; readonly slot: v.GenericSchema<WeaponItemRowsInput['slot'], WeaponItemRows['slot']>; readonly context: v.GenericSchema<WeaponItemRowsInput['context'], WeaponItemRows['context']>; readonly ui: v.GenericSchema<WeaponItemRowsInput['ui'], WeaponItemRows['ui']>; readonly view: v.GenericSchema<WeaponItemRowsInput['view'], WeaponItemRows['view']>; readonly hook: v.GenericSchema<WeaponItemRowsInput['hook'], WeaponItemRows['hook']>; readonly equipment: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['equipment'], undefined>, Exclude<WeaponItemRows['equipment'], undefined>>, undefined>; readonly profile: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['profile'], undefined>, Exclude<WeaponItemRows['profile'], undefined>>, undefined>; readonly ranged: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['ranged'], undefined>, Exclude<WeaponItemRows['ranged'], undefined>>, undefined>; readonly contacts: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['contacts'], undefined>, Exclude<WeaponItemRows['contacts'], undefined>>, undefined>; readonly secondary: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['secondary'], undefined>, Exclude<WeaponItemRows['secondary'], undefined>>, undefined>; readonly native: v.ExactOptionalSchema<v.GenericSchema<Exclude<WeaponItemRowsInput['native'], undefined>, Exclude<WeaponItemRows['native'], undefined>>, undefined>; readonly light: typeof attack; readonly heavy: v.GenericSchema<WeaponItemRowsInput['heavy'], WeaponItemRows['heavy']>; readonly charge: v.GenericSchema<WeaponItemRowsInput['charge'], WeaponItemRows['charge']>; }, undefined> = v.strictObject({ id: weaponId, kind: v.literal('weapon'), family: name, slot, context: name, ui, view, hook,
  equipment: v.exactOptional(equipment),
  profile: v.exactOptional(WeaponProfileSchema), ranged: v.exactOptional(NativeRangedRowSchema), contacts: v.exactOptional(MeleeContactsSchema),
  secondary: v.exactOptional(secondary), native: v.exactOptional(NativeMeleeRowSchema),
  light: attack, heavy: attack, charge: v.pipe(duration, v.maxValue(5)) });
const tool: v.StrictObjectSchema<{ readonly id: v.GenericSchema<ToolItemRowsInput['id'], ToolItemRows['id']>; readonly kind: v.GenericSchema<ToolItemRowsInput['kind'], ToolItemRows['kind']>; readonly family: v.GenericSchema<ToolItemRowsInput['family'], ToolItemRows['family']>; readonly ui: v.GenericSchema<ToolItemRowsInput['ui'], ToolItemRows['ui']>; readonly view: v.GenericSchema<ToolItemRowsInput['view'], ToolItemRows['view']>; readonly hook: v.GenericSchema<ToolItemRowsInput['hook'], ToolItemRows['hook']>; readonly equipment: v.ExactOptionalSchema<v.GenericSchema<Exclude<ToolItemRowsInput['equipment'], undefined>, Exclude<ToolItemRows['equipment'], undefined>>, undefined>; readonly action: v.NullableSchema<v.GenericSchema<Exclude<ToolItemRowsInput['action'], null>, Exclude<ToolItemRows['action'], null>>, undefined>; readonly fuelSeconds: v.GenericSchema<ToolItemRowsInput['fuelSeconds'], ToolItemRows['fuelSeconds']>; readonly intensity: v.GenericSchema<ToolItemRowsInput['intensity'], ToolItemRows['intensity']>; }, undefined> = v.strictObject({ id: toolId, kind: v.literal('tool'), family: name, ui, view, hook,
  equipment: v.exactOptional(v.strictObject({ ...equipment.entries, id: toolId,
    meta: v.strictObject({ ...equipment.entries.meta.entries, category: text }) })), action: v.nullable(v.custom<`${string}.${string}`>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))),
  fuelSeconds: duration, intensity: v.pipe(finite, v.minValue(0), v.maxValue(10)) });
/** The closed baseline weapon context with optional declared controls. */
export const ItemContextSchema: v.GenericSchema<ItemContextRowsInput, ItemContextRows> = v.variant('keysFrom', [
  v.strictObject({ id: name, keysFrom: v.literal('weapon.melee'), actions: v.tuple([v.literal('attack'), v.literal('heavy'), v.literal('lock')]), touch: v.literal('melee'), lockable: v.boolean(), extra: v.exactOptional(InputExtraSchema) }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.ranged'), actions: v.tuple([v.literal('attack'), v.literal('aim'), v.literal('reload')]), touch: v.literal('ranged'), lockable: v.boolean(), extra: v.exactOptional(InputExtraSchema) }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.bow'), actions: v.tuple([v.literal('attack'), v.literal('aim')]), touch: v.literal('bow'), lockable: v.boolean(), extra: v.exactOptional(InputExtraSchema) }),
  v.strictObject({ id: name, keysFrom: v.literal('weapon.spear'), actions: v.tuple([v.literal('attack'), v.literal('aim')]), touch: v.literal('throwing'), lockable: v.boolean(), extra: v.exactOptional(InputExtraSchema) }),
]);
const baselineContexts = new Set(['weapon.melee', 'weapon.ranged', 'weapon.bow', 'weapon.spear']);
/** Saved inventory policy consumed unchanged by the existing native stacking/trade owner. */
const inventory = v.pipe(v.strictObject({ kinds: v.pipe(v.array(name), v.minLength(1), v.maxLength(256)),
  slots: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)),
  counts: v.strictObject({ min: finite, max: finite, integer: v.boolean(), complete: v.boolean() }),
  quantity: v.picklist(['unchecked', 'positive-safe-integer']), snapshot: v.picklist(['order', 'roster']),
  stackLimit: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER))), restoreError: text }),
  v.check(row => new Set(row.kinds).size === row.kinds.length && row.counts.min <= row.counts.max, 'Unique inventory kinds and ordered count bounds'));
const catalogue = v.pipe(v.array(v.strictObject({ id: name, label: text, icon: CatalogueIconSchema, travels: v.boolean() })), v.maxLength(256));
const raw: v.StrictObjectSchema<{ readonly version: v.GenericSchema<ShardItemsInput['version'], ShardItems['version']>; readonly catalogue: v.ExactOptionalSchema<v.GenericSchema<Exclude<ShardItemsInput['catalogue'], undefined>, Exclude<ShardItems['catalogue'], undefined>>, undefined>; readonly rows: v.SchemaWithPipe<readonly [v.ArraySchema<v.VariantSchema<'kind', readonly [typeof weapon, typeof tool], undefined>, undefined>, v.MaxLengthAction<(WeaponItemRows | ToolItemRows)[], 64, undefined>]>; readonly launches: v.ExactOptionalSchema<v.GenericSchema<Exclude<ShardItemsInput['launches'], undefined>, Exclude<ShardItems['launches'], undefined>>, undefined>; readonly pickups: v.ExactOptionalSchema<v.GenericSchema<Exclude<ShardItemsInput['pickups'], undefined>, Exclude<ShardItems['pickups'], undefined>>, undefined>; readonly contexts: v.GenericSchema<ShardItemsInput['contexts'], ShardItems['contexts']>; readonly runtimeContexts: v.ExactOptionalSchema<v.GenericSchema<Exclude<ShardItemsInput['runtimeContexts'], undefined>, Exclude<ShardItems['runtimeContexts'], undefined>>, undefined>; readonly loadout: v.GenericSchema<ShardItemsInput['loadout'], ShardItems['loadout']>; }, undefined> = v.strictObject({ version: v.literal(1), catalogue: v.exactOptional(catalogue), rows: v.pipe(v.array(v.variant('kind', [weapon, tool])), v.maxLength(64)),
  launches: v.exactOptional(v.pipe(v.record(name, BodyLaunchSchema), v.maxEntries(64))),
  pickups: v.exactOptional(v.pipe(v.record(name, ClaimedPickupSchema), v.maxEntries(128))),
  contexts: v.pipe(v.array(ItemContextSchema), v.maxLength(64)),
  runtimeContexts: v.exactOptional(v.pipe(v.array(name), v.maxLength(64))),
  loadout: v.strictObject({ effects: v.exactOptional(v.strictObject({
    statuses: v.boolean(), player: LootEconomySchema.entries.grants.entries.player, worn: LootEconomySchema.entries.grants.entries.worn,
    weapons: v.pipe(v.array(v.strictObject({ items: v.pipe(v.array(weaponId), v.minLength(1), v.maxLength(64)), grants: LootEconomySchema.entries.grants.entries.weapons })), v.maxLength(64)),
    hitCap: v.exactOptional(effect),
  })), runtime: v.exactOptional(v.strictObject({
    pause: v.boolean(), sliceMs: v.exactOptional(v.pipe(finite, v.minValue(1), v.maxValue(1000))),
    owners: v.pipe(v.array(v.strictObject({ item: weaponId, slot: v.picklist(['primary', 'rifle', 'secondary', 'extra']),
      row: v.picklist(['native', 'declared']), presentation: v.exactOptional(v.boolean()) })), v.minLength(1), v.maxLength(16)),
  })), native: v.exactOptional(NativeLoadoutRowSchema), inventory: v.exactOptional(inventory), primary: v.nullable(weaponId), secondary: v.nullable(weaponId), tools: v.pipe(v.array(toolId), v.maxLength(16)) }) });
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
  if(native.held!==undefined){
    const action=native.actions.find(row=>row.action===native.held?.action),contact=action===undefined?undefined:contacts[action.move];
    if(action?.hook!==null||contact?.lane!=='primary'||!contact.heavy)throw new TypeError('Held release requires an admitted primary heavy contact');
  }
  return { native, contacts };
}
/** Declared swept phases share the existing melee owner; no new actor or physics authority. */
const sweptCoefficient = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const sweptPolicy: v.GenericSchema<NativeSweptPolicyRowsInput, NativeSweptPolicyRows> = v.strictObject({ kind: v.literal('swept'), step: name, selection: v.exactOptional(NativeLoadoutRowSchema),
  eye: v.pipe(finite, v.minValue(0), v.maxValue(20)), initial: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(15)),
  source: v.picklist(['env', 'owner']),
  slots: v.pipe(v.array(v.strictObject({ item: weaponId, weapon: weaponId, tags: v.pipe(v.array(tag), v.maxLength(32)),
    combo: v.pipe(v.array(name), v.minLength(1), v.maxLength(16)), heavy: name })), v.minLength(1), v.maxLength(16)),
  contact: v.strictObject({ slack: v.pipe(finite, v.minValue(0), v.maxValue(2)), direction: v.tuple([sweptCoefficient, sweptCoefficient, sweptCoefficient]),
    push: v.tuple([sweptCoefficient, sweptCoefficient]), running: v.pipe(finite, v.minValue(0), v.maxValue(100)) }),
  lunge: v.strictObject({ maxHeight: v.pipe(finite, v.minValue(0), v.maxValue(20)), minDistance: v.pipe(finite, v.minValue(0.000001), v.maxValue(10)),
    minRadius: v.pipe(finite, v.minValue(0), v.maxValue(20)), lengthScale: v.pipe(finite, v.minValue(0), v.maxValue(10)) }),
});
/** Admit a bounded swept kit against real item profiles before installing clocks or contacts. */
interface NativeSweptMove extends Omit<Extract<v.InferOutput<typeof WeaponProfileSchema>, {family: 'melee'}>['moves']['heavy'], 'stagger' | 'sweep'> {
  id: string; stagger: number; sweep: number;
}
interface NativeSweptProfile extends Omit<Extract<v.InferOutput<typeof WeaponProfileSchema>, {family: 'melee'}>, 'moves'> {
  weapon: v.InferOutput<typeof weaponId>; tags: v.InferOutput<typeof tag>[]; moves: {combo: NativeSweptMove[]; heavy: NativeSweptMove};
}
/** Admitted numeric phases and item profiles, detached from renderer or actor authority. */
export interface NativeSweptMeleeBinding { row: v.InferOutput<typeof sweptPolicy>; profiles: NativeSweptProfile[] }
/** Parse a complete swept kit before any clocks, callbacks or native state are installed. */
export function parseNativeSweptMeleeBinding(input: unknown, itemsInput: unknown): NativeSweptMeleeBinding {
  v.assert(v.custom(isJsonData, 'JSON-only swept melee policy'), input);
  const row = v.parse(sweptPolicy, input), items = v.parse(v.pipe(v.array(v.union([weapon, tool])), v.maxLength(512)), itemsInput);
  if (row.initial >= row.slots.length || new Set(row.slots.map(entry => entry.item)).size !== row.slots.length) throw new Error('Invalid swept melee slots');
  if (row.selection !== undefined && (row.selection.initial !== row.initial || row.selection.slots.length !== row.slots.length
    || row.selection.slots.some((value, index) => value !== index) || row.selection.lower !== 0 || row.selection.raise !== 0
    || row.selection.ownership?.some(flag => flag !== null) === true || row.selection.input !== undefined)) throw new Error('Invalid swept selection policy');
  const profiles = row.slots.map(entry => {
    const item = items.find(candidate => candidate.id === entry.item);
    if (item?.kind !== 'weapon' || item.profile?.family !== 'melee' || item.profile.moves.combo.length !== entry.combo.length) throw new Error('Swept melee requires matching admitted item moves');
    const profile = item.profile;
    if (new Set([...entry.combo, entry.heavy]).size !== entry.combo.length + 1) throw new Error('Unique swept move ids required');
    const move = (numbers: typeof profile.moves.heavy, id: string) => {
      if (numbers.stagger === undefined || numbers.sweep === undefined) throw new Error('Swept melee requires explicit stagger and sweep');
      return { ...numbers, stagger: numbers.stagger, sweep: numbers.sweep, id };
    };
    return { ...profile, weapon: entry.weapon, tags: entry.tags,
      moves: { combo: profile.moves.combo.map((numbers, index) => { const id = entry.combo[index]; if (id === undefined) throw new Error('Missing swept move id'); return move(numbers, id); }), heavy: move(profile.moves.heavy, entry.heavy) } };
  });
  return { row, profiles };
}
/** Declared item families, numeric contacts, input contexts, script hooks and initial loadout. */

/** Local references plus optional script catalogue checks; global format composition supplies admitted module ids. */
export function itemRules(items: ShardItems, modules?: readonly string[]): string[] {
  const errors: string[] = [];
  if (new Set(items.catalogue?.map(row => row.id)).size !== (items.catalogue?.length ?? 0)) errors.push('unique catalogue item ids');
  const ids = items.rows.map((r) => r.id), weapons = items.rows.filter((r) => r.kind === 'weapon');
  const runtimeContexts = items.runtimeContexts ?? [];
  if (items.loadout.effects?.weapons.some(binding => new Set(binding.items).size !== binding.items.length
    || binding.items.some(id => !weapons.some(entry => entry.id === id && entry.equipment?.legacySlot !== undefined))) === true)
    errors.push('item effect targets need unique native equipment ids');
  if (weapons.some(row => row.profile !== undefined && !row.family.includes('.') && row.family !== row.profile.family && !(row.family === 'swept' && row.profile.family === 'melee'))) errors.push('weapon profile matches declared family');
  if (weapons.some(row => row.profile?.family === 'cone' && (row.light.range !== row.heavy.range
    || row.light.width !== row.heavy.width || row.light.width > Math.PI || row.light.effect !== null || row.heavy.effect !== null
    || row.light.tags.length !== row.heavy.tags.length || row.light.tags.some((value, index) => value !== row.heavy.tags[index]))))
    errors.push('cone slashes require one shared contact shape and tags');
  if (weapons.some(row => row.secondary !== undefined && ((row.secondary.code === undefined) !== (row.hook === null)
    || row.contacts?.[row.secondary.move]?.lane !== 'secondary'))) errors.push('secondary references its declared action mode and secondary contact');
  if (weapons.some(row => row.native !== undefined && (row.contacts === undefined || row.native.actions.some(action => {
    const contact = row.contacts?.[action.move];
    return contact === undefined || (row.native?.mode === 'timed') !== (contact.lands.length > 0)
      || action.hook !== null && (row.hook === null || row.secondary?.code !== action.hook || row.secondary.move !== action.move);
  })))) errors.push('native melee actions resolve admitted contacts and script hooks');
  const nativeSteps = weapons.flatMap(row => [...(row.native === undefined ? [] : [row.native.step]), ...(row.ranged === undefined ? [] : [row.ranged.step])]);
  if (weapons.some(row => row.ranged !== undefined && (row.native !== undefined || (row.profile?.family !== 'bow' && row.profile?.family !== 'firearm')))) errors.push('native ranged requires its admitted weapon profile');
  if (new Set(nativeSteps).size !== nativeSteps.length) errors.push('unique native melee steps');
  if (items.rows.some((row) => row.kind === 'tool' && row.action === null && row.hook !== null)) errors.push('native tools have no script hook');
  for (const ctx of items.contexts) errors.push(...inputExtraRules(ctx.extra, ctx.actions, ctx.id.split('.')[0] ?? ctx.id));
  if (items.contexts.some((ctx) => baselineContexts.has(ctx.id))) errors.push('baseline context is referenced rather than redeclared');
  if (new Set(runtimeContexts).size !== runtimeContexts.length || runtimeContexts.some((id) => items.contexts.some((ctx) => ctx.id === id))) errors.push('unique runtime context references separate from declared contexts');
  if (new Set(ids).size !== ids.length || new Set(weapons.map((r) => r.slot)).size !== weapons.length
    || new Set(items.contexts.map((r) => r.id)).size !== items.contexts.length) errors.push('unique item ids slots and contexts');
  if (weapons.some((r) => r.slot !== `declared.${r.id}`)) errors.push('stable weapon slot');
  if (weapons.some((r) => r.context !== 'weapon.melee' && !runtimeContexts.includes(r.context) && !items.contexts.some((c) => c.id === r.context))) errors.push('declared weapon context');
  const owners = items.loadout.runtime?.owners;
  if (owners !== undefined && (owners[0]?.slot !== 'primary' || owners[0].item !== items.loadout.primary
    || owners.length !== weapons.length || new Set(owners.map(owner => owner.item)).size !== owners.length
    || owners.some(owner => !weapons.some(row => row.id === owner.item))
    || ['primary', 'rifle', 'secondary'].some(place => owners.filter(owner => owner.slot === place).length > 1)
    || (owners.find(owner => owner.slot === 'secondary')?.item ?? null) !== items.loadout.secondary)) errors.push('runtime equipment owners');
  for (const id of [items.loadout.primary, items.loadout.secondary]) if (id !== null && !weapons.some((r) => r.id === id)) errors.push('weapon loadout reference');
  if (items.rows.length > 0 && items.loadout.primary === null) errors.push('primary weapon required');
  if (items.loadout.primary !== null && items.loadout.primary === items.loadout.secondary) errors.push('distinct loadout weapons');
  if (new Set(items.loadout.tools).size !== items.loadout.tools.length || items.loadout.tools.some((id) => !items.rows.some((r) => r.kind === 'tool' && r.id === id))) errors.push('tool loadout reference');
  const handles = items.rows.flatMap((r) => r.hook === null ? [] : [r.hook.entity]);
  if (new Set(handles).size !== handles.length) errors.push('unique item script handles');
  if (modules !== undefined && items.rows.some((r) => r.hook !== null && !modules.includes(r.hook.module))) errors.push('item script module declared');
  return [...new Set(errors)];
}
const items: v.SchemaWithPipe<readonly [v.UnknownSchema, v.CheckAction<unknown, 'JSON-only items'>, typeof raw, v.CheckAction<ShardItems, 'valid item references'>]> = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only items'), raw, v.check((data) => itemRules(data).length === 0, 'valid item references'));
/** JSON-only admission rejects closures before serialisation and checks all item/loadout references.
 * The named output bounds root-schema inference; pipe identities remain available to the JSON Schema bridge. */
export const ItemsSchema: v.GenericSchema<unknown, ShardItems> & Pick<typeof items, 'pipe'> = items;
/** Validate authored item rows at both SDK and browser boundaries. */
export function parseItems(input: unknown): ShardItems { return v.parse(ItemsSchema, input); }

/** Admitted item data independent of validator implementation metadata. */
export type ItemFamilyNameRowsInput = ItemFamilyNameRows;
export type ItemFamilyNameRows = string;
export type CatalogueIconNameInput = CatalogueIconName;
export type CatalogueIconName = 'lock' | 'check' | 'poi' | 'you' | 'map' | 'pack' | 'star' | 'book' | 'heart' | 'pin' | 'laurel' | 'sword' | 'deer' | 'elk' | 'boar' | 'bear' | 'ghost' | 'ironhide' | 'meat' | 'hide' | 'tusk' | 'antlers' | 'bolt' | 'claw' | 'shell' | 'coconut' | 'coin' | 'seaglass' | 'rope' | 'whetstone' | 'chart' | 'bearclaw' | 'boartusk' | 'crossbow' | 'rifle' | 'lever' | 'longbow' | 'hat' | 'cape' | 'charm' | 'necklace' | 'glyph' | 'purse' | 'talon' | 'leopard' | 'wolf' | 'eagle' | 'rider' | 'horse' | 'grapple';
export type ItemContextRowsInput = ({ id: ItemFamilyNameRowsInput; keysFrom: 'weapon.melee'; actions: ['attack', 'heavy', 'lock']; touch: 'melee'; lockable: boolean; extra?: v.InferInput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRowsInput; keysFrom: 'weapon.ranged'; actions: ['attack', 'aim', 'reload']; touch: 'ranged'; lockable: boolean; extra?: v.InferInput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRowsInput; keysFrom: 'weapon.bow'; actions: ['attack', 'aim']; touch: 'bow'; lockable: boolean; extra?: v.InferInput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRowsInput; keysFrom: 'weapon.spear'; actions: ['attack', 'aim']; touch: 'throwing'; lockable: boolean; extra?: v.InferInput<typeof InputExtraSchema>; });
export type ItemContextRows = ({ id: ItemFamilyNameRows; keysFrom: 'weapon.melee'; actions: ['attack', 'heavy', 'lock']; touch: 'melee'; lockable: boolean; extra?: v.InferOutput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRows; keysFrom: 'weapon.ranged'; actions: ['attack', 'aim', 'reload']; touch: 'ranged'; lockable: boolean; extra?: v.InferOutput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRows; keysFrom: 'weapon.bow'; actions: ['attack', 'aim']; touch: 'bow'; lockable: boolean; extra?: v.InferOutput<typeof InputExtraSchema>; }) | ({ id: ItemFamilyNameRows; keysFrom: 'weapon.spear'; actions: ['attack', 'aim']; touch: 'throwing'; lockable: boolean; extra?: v.InferOutput<typeof InputExtraSchema>; });
export interface WeaponItemRowsInput { id: `weapon.${string}`; kind: 'weapon'; family: ItemFamilyNameRowsInput; slot: `declared.weapon.${string}`; context: ItemFamilyNameRowsInput; ui: { name: string; icon: ItemFamilyNameRowsInput; swapIcon: string; blurb: string; }; view: { asset?: string; recipe: ItemFamilyNameRowsInput; colour: string; position: [number, number, number]; rotation: [number, number, number]; }; hook: ({ module: string; entity: number; event: number; }) | null; equipment?: ItemEquipmentRowsInput; profile?: v.InferInput<typeof WeaponProfileSchema>; ranged?: v.InferInput<typeof NativeRangedRowSchema>; contacts?: v.InferInput<typeof MeleeContactsSchema>; secondary?: { action: ItemFamilyNameRowsInput; code?: 3 | 4; move: number; }; native?: v.InferInput<typeof NativeMeleeRowSchema>; light: ItemAttackRowsInput; heavy: ItemAttackRowsInput; charge: number; }
export interface WeaponItemRows { id: `weapon.${string}`; kind: 'weapon'; family: ItemFamilyNameRows; slot: `declared.weapon.${string}`; context: ItemFamilyNameRows; ui: { name: string; icon: ItemFamilyNameRows; swapIcon: string; blurb: string; }; view: { asset?: string; recipe: ItemFamilyNameRows; colour: string; position: [number, number, number]; rotation: [number, number, number]; }; hook: ({ module: string; entity: number; event: number; }) | null; equipment?: ItemEquipmentRows; profile?: v.InferOutput<typeof WeaponProfileSchema>; ranged?: v.InferOutput<typeof NativeRangedRowSchema>; contacts?: v.InferOutput<typeof MeleeContactsSchema>; secondary?: { action: ItemFamilyNameRows; code?: 3 | 4; move: number; }; native?: v.InferOutput<typeof NativeMeleeRowSchema>; light: ItemAttackRows; heavy: ItemAttackRows; charge: number; }
export interface ToolItemRowsInput { id: `tool.${string}`; kind: 'tool'; family: ItemFamilyNameRowsInput; ui: { name: string; icon: ItemFamilyNameRowsInput; swapIcon: string; blurb: string; }; view: { asset?: string; recipe: ItemFamilyNameRowsInput; colour: string; position: [number, number, number]; rotation: [number, number, number]; }; hook: ({ module: string; entity: number; event: number; }) | null; equipment?: { id: `tool.${string}`; meta: { category: string; } & Omit<v.InferInput<typeof equipment.entries.meta>, "category">; } & Omit<ItemEquipmentRowsInput, "id" | "meta">; action: (`${string}.${string}`) | null; fuelSeconds: number; intensity: number; }
export interface ToolItemRows { id: `tool.${string}`; kind: 'tool'; family: ItemFamilyNameRows; ui: { name: string; icon: ItemFamilyNameRows; swapIcon: string; blurb: string; }; view: { asset?: string; recipe: ItemFamilyNameRows; colour: string; position: [number, number, number]; rotation: [number, number, number]; }; hook: ({ module: string; entity: number; event: number; }) | null; equipment?: { id: `tool.${string}`; meta: { category: string; } & Omit<v.InferOutput<typeof equipment.entries.meta>, "category">; } & Omit<ItemEquipmentRows, "id" | "meta">; action: (`${string}.${string}`) | null; fuelSeconds: number; intensity: number; }
export interface ItemAttackRowsInput { id: ItemFamilyNameRowsInput; damage: number; cooldown: number; range: number; width: number; tags: (`${string}.${string}`)[]; effect: (`effect.${string}`) | null; }
export interface ItemAttackRows { id: ItemFamilyNameRows; damage: number; cooldown: number; range: number; width: number; tags: (`${string}.${string}`)[]; effect: (`effect.${string}`) | null; }
export interface ShardItemsInput { version: 1; catalogue?: ({ id: ItemFamilyNameRowsInput; label: string; icon: CatalogueIconNameInput; travels: boolean; })[]; rows: ((WeaponItemRowsInput) | (ToolItemRowsInput))[]; launches?: Record<string, v.InferInput<typeof BodyLaunchSchema>>; pickups?: Record<string, v.InferInput<typeof ClaimedPickupSchema>>; contexts: (ItemContextRowsInput)[]; runtimeContexts?: (ItemFamilyNameRowsInput)[]; loadout: { effects?: { statuses: boolean; player: v.InferInput<typeof LootEconomySchema.entries.grants.entries.player>; worn: v.InferInput<typeof LootEconomySchema.entries.grants.entries.worn>; weapons: ({ items: (`weapon.${string}`)[]; grants: v.InferInput<typeof LootEconomySchema.entries.grants.entries.weapons>; })[]; hitCap?: `effect.${string}`; }; runtime?: { pause: boolean; sliceMs?: number; owners: ({ item: `weapon.${string}`; slot: 'primary' | 'rifle' | 'secondary' | 'extra'; row: 'native' | 'declared'; presentation?: boolean; })[]; }; native?: v.InferInput<typeof NativeLoadoutRowSchema>; inventory?: { kinds: (ItemFamilyNameRowsInput)[]; slots: number; counts: { min: number; max: number; integer: boolean; complete: boolean; }; quantity: 'unchecked' | 'positive-safe-integer'; snapshot: 'order' | 'roster'; stackLimit?: number; restoreError: string; }; primary: (`weapon.${string}`) | null; secondary: (`weapon.${string}`) | null; tools: (`tool.${string}`)[]; }; }
export interface ShardItems { version: 1; catalogue?: ({ id: ItemFamilyNameRows; label: string; icon: CatalogueIconName; travels: boolean; })[]; rows: ((WeaponItemRows) | (ToolItemRows))[]; launches?: Record<string, v.InferOutput<typeof BodyLaunchSchema>>; pickups?: Record<string, v.InferOutput<typeof ClaimedPickupSchema>>; contexts: (ItemContextRows)[]; runtimeContexts?: (ItemFamilyNameRows)[]; loadout: { effects?: { statuses: boolean; player: v.InferOutput<typeof LootEconomySchema.entries.grants.entries.player>; worn: v.InferOutput<typeof LootEconomySchema.entries.grants.entries.worn>; weapons: ({ items: (`weapon.${string}`)[]; grants: v.InferOutput<typeof LootEconomySchema.entries.grants.entries.weapons>; })[]; hitCap?: `effect.${string}`; }; runtime?: { pause: boolean; sliceMs?: number; owners: ({ item: `weapon.${string}`; slot: 'primary' | 'rifle' | 'secondary' | 'extra'; row: 'native' | 'declared'; presentation?: boolean; })[]; }; native?: v.InferOutput<typeof NativeLoadoutRowSchema>; inventory?: { kinds: (ItemFamilyNameRows)[]; slots: number; counts: { min: number; max: number; integer: boolean; complete: boolean; }; quantity: 'unchecked' | 'positive-safe-integer'; snapshot: 'order' | 'roster'; stackLimit?: number; restoreError: string; }; primary: (`weapon.${string}`) | null; secondary: (`weapon.${string}`) | null; tools: (`tool.${string}`)[]; }; }
export interface NativeSweptPolicyRowsInput { kind: 'swept'; step: ItemFamilyNameRowsInput; selection?: v.InferInput<typeof NativeLoadoutRowSchema>; eye: number; initial: number; source: 'env' | 'owner'; slots: ({ item: `weapon.${string}`; weapon: `weapon.${string}`; tags: (`${string}.${string}`)[]; combo: (ItemFamilyNameRowsInput)[]; heavy: ItemFamilyNameRowsInput; })[]; contact: { slack: number; direction: [number, number, number]; push: [number, number]; running: number; }; lunge: { maxHeight: number; minDistance: number; minRadius: number; lengthScale: number; }; }
export interface NativeSweptPolicyRows { kind: 'swept'; step: ItemFamilyNameRows; selection?: v.InferOutput<typeof NativeLoadoutRowSchema>; eye: number; initial: number; source: 'env' | 'owner'; slots: ({ item: `weapon.${string}`; weapon: `weapon.${string}`; tags: (`${string}.${string}`)[]; combo: (ItemFamilyNameRows)[]; heavy: ItemFamilyNameRows; })[]; contact: { slack: number; direction: [number, number, number]; push: [number, number]; running: number; }; lunge: { maxHeight: number; minDistance: number; minRadius: number; lengthScale: number; }; }
export interface ItemEquipmentRowsInput { id: string; legacySlot?: 'crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty'; ui: { name: string; icon: CatalogueIconNameInput; swapIcon: string; touch: 'melee' | 'bow' | 'ranged' | 'throwing'; lockOn: boolean; melee: boolean; tracers: boolean; inputContext?: ItemFamilyNameRowsInput; swapName?: string; huntersEye?: boolean; ammo?: { label: string; segments: number; magazine?: boolean; bagLabel?: string; bagLabelFor?: string; }; }; meta: { name: string; icon: CatalogueIconNameInput; blurb: string; category: ItemFamilyNameRowsInput; }; cues?: { fire: string; reload: string; impact: string; dry?: string; hit?: string; heavy?: string; charge?: Record<string, string>; }; hitStop?: { body: number; head: number; kill: number; }; rangedFeel?: { kick: { body: number; head: number; kill: number; side: number; killSide: number; }; trauma: { kill: number; head: number; killKinds: (ItemFamilyNameRowsInput)[]; headKinds: (ItemFamilyNameRowsInput)[]; }; }; tags?: (`${string}.${string}`)[]; }
export interface ItemEquipmentRows { id: string; legacySlot?: 'crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty'; ui: { name: string; icon: CatalogueIconName; swapIcon: string; touch: 'melee' | 'bow' | 'ranged' | 'throwing'; lockOn: boolean; melee: boolean; tracers: boolean; inputContext?: ItemFamilyNameRows; swapName?: string; huntersEye?: boolean; ammo?: { label: string; segments: number; magazine?: boolean; bagLabel?: string; bagLabelFor?: string; }; }; meta: { name: string; icon: CatalogueIconName; blurb: string; category: ItemFamilyNameRows; }; cues?: { fire: string; reload: string; impact: string; dry?: string; hit?: string; heavy?: string; charge?: Record<string, string>; }; hitStop?: { body: number; head: number; kill: number; }; rangedFeel?: { kick: { body: number; head: number; kill: number; side: number; killSide: number; }; trauma: { kill: number; head: number; killKinds: (ItemFamilyNameRows)[]; headKinds: (ItemFamilyNameRows)[]; }; }; tags?: (`${string}.${string}`)[]; }
