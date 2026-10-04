import * as v from 'valibot';
import { isJsonData } from './json';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimStrike } from '@wildshard/engine/sim';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0.000001), v.maxValue(10000000));
const nonnegative = v.pipe(finite, v.minValue(0), v.maxValue(10000000));
const unit = v.pipe(finite, v.minValue(0), v.maxValue(1));
const dimension = v.pipe(positive, v.maxValue(20));
const duration = v.pipe(positive, v.maxValue(86400));
const ordered = v.pipe(v.tuple([positive, positive]), v.check(([a, b]) => a <= b, 'ordered range'));
const shape = v.variant('kind', [
  v.strictObject({ kind: v.literal('point'), radius: dimension }), v.strictObject({ kind: v.literal('sphere'), radius: dimension }),
  v.strictObject({ kind: v.literal('lane'), length: dimension, width: dimension }),
  v.strictObject({ kind: v.literal('arc'), radius: dimension, halfAngle: v.pipe(positive, v.maxValue(Math.PI)) }),
  v.strictObject({ kind: v.literal('wedge'), length: dimension, halfAngle: v.pipe(positive, v.maxValue(Math.PI)) }),
  v.pipe(v.strictObject({ kind: v.literal('ring'), inner: nonnegative, outer: dimension }), v.check((r) => r.inner <= r.outer, 'ordered ring')),
]);
const strike = v.strictObject({ id, shape, windup: nonnegative, active: nonnegative, recover: nonnegative, cooldown: nonnegative, range: dimension, damage: nonnegative,
  tags: v.pipe(v.array(v.custom<CombatTag>((value) => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))), v.maxLength(32)), weight: nonnegative, speed: v.pipe(nonnegative, v.maxValue(15)) });
const numbers = v.strictObject({ overcast: unit, rain: unit, wet: unit, wind: unit, fog: unit });
const weather = v.strictObject({ id, states: v.pipe(v.array(v.strictObject({ id, next: id, length: ordered, numbers })), v.minLength(1), v.maxLength(64)), initial: numbers, soak: unit, dry: unit,
  modes: v.pipe(v.array(v.strictObject({ id, hold: v.nullable(id), at: unit, dry: v.boolean() })), v.maxLength(64)) });
const hour = v.pipe(finite, v.minValue(0), v.maxValue(24));
const day = v.strictObject({ id, units: v.literal('hour'), start: hour,
  schedule: v.pipe(v.array(v.strictObject({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: hour, to: hour, minutes: duration })), v.minLength(1), v.maxLength(64)),
  sun: v.strictObject({ maxElevation: v.pipe(finite, v.minValue(0), v.maxValue(90)), azimuthOffset: v.pipe(finite, v.minValue(-180), v.maxValue(180)) }),
  fixed: v.strictObject({ midday: hour, golden: hour, sunset: hour, night: hour }), presets: v.strictObject({ dawn: hour, noon: hour, dusk: hour, night: hour }) });
const mods = v.strictObject({ speed: positive, chargeDist: positive, damageTaken: positive, chargeDamage: nonnegative, relentless: v.boolean() });
const dims = v.strictObject({ bodyY: dimension, bodyHalfLen: dimension, bodyRadius: dimension, headRadius: dimension, legLen: dimension,
  feet: v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(16)), halfWidth: dimension });
const variant = v.strictObject({ id, label: text, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), weight: nonnegative, scale: ordered, hp: positive, mods });
const flight = v.strictObject({ altitude: v.pipe(finite, v.minValue(-250), v.maxValue(250)),
  above: v.exactOptional(v.picklist(['ground', 'world'])), climbRate: v.pipe(positive, v.maxValue(30)), diveRate: v.pipe(positive, v.maxValue(30)),
  lockRange: v.exactOptional(v.pipe(positive, v.maxValue(600))), bank: v.exactOptional(v.pipe(finite, v.check(n => n > 0 && n < Math.PI / 2, 'flight bank between 0 and pi/2'))) });
const species = v.strictObject({ id, kind: id, label: text, aggressive: v.boolean(), lockable: v.boolean(), dims, flight: v.exactOptional(flight),
  variants: v.pipe(v.array(variant), v.minLength(1), v.maxLength(64)) });
const parameter = v.union([finite, v.boolean(), text, v.pipe(v.array(finite), v.maxLength(16))]);
const look = v.strictObject({ id, species: id, recipe: id, material: v.optional(v.nullable(id), null), parameters: v.record(id, parameter),
  animation: v.strictObject({ recipe: id, parameters: v.record(id, parameter) }) });
const compendium = v.strictObject({ id, className: id, title: text, tabs: v.pipe(v.array(v.strictObject({ id, label: text })), v.maxLength(16)), stamp: text,
  stats: v.pipe(v.array(v.strictObject({ label: text, value: text })), v.maxLength(8)),
  entries: v.pipe(v.array(v.strictObject({ id, kind: v.literal('species'), tab: id, name: text, notes: text, sketch: v.pipe(v.string(), v.maxLength(500000)), species: id })), v.maxLength(256)) });
const loot = v.strictObject({ id, gear: v.literal('purse.coins'), finds: v.null(), marks: v.null(), charted: v.boolean(), chime: id });
const raw = v.strictObject({ strikes: v.pipe(v.array(strike), v.maxLength(256)), weather: v.pipe(v.array(weather), v.maxLength(16)), days: v.pipe(v.array(day), v.maxLength(16)),
  species: v.pipe(v.array(species), v.maxLength(256)), looks: v.pipe(v.array(look), v.maxLength(256)), compendiums: v.pipe(v.array(compendium), v.maxLength(16)), loot: v.pipe(v.array(loot), v.maxLength(16)) });
/** Pure author rows: numeric weights, state output tables, clocks and registered view/presentation recipes. */
export type ShardRows = v.InferOutput<typeof raw>;
/** Reference, uniqueness and complete clock/weather transition rules for data rows. */
export function rowRules(rows: ShardRows): string[] {
  const errors: string[] = [];
  for (const list of Object.values(rows)) if (new Set(list.map((r) => r.id)).size !== list.length) errors.push('unique row ids');
  for (const w of rows.weather) {
    const states = new Set(w.states.map((s) => s.id));
    if (states.size !== w.states.length || w.states.some((s) => !states.has(s.next)) || w.modes.some((m) => m.hold !== null && !states.has(m.hold)) || new Set(w.modes.map((m) => m.id)).size !== w.modes.length) errors.push('weather states and transitions');
  }
  for (const d of rows.days) if (d.schedule[0]?.from !== 0 || d.schedule.at(-1)?.to !== 24 || d.schedule.some((s, i) => s.from >= s.to || (i > 0 && d.schedule[i - 1]?.to !== s.from))) errors.push('complete ordered day schedule');
  const speciesIds = new Set(rows.species.map((s) => s.id));
  for (const s of rows.species) if (new Set(s.variants.map((r) => r.id)).size !== s.variants.length || s.variants.some((r) => r.scale[1] > 10)) errors.push('species variants');
  for (const l of rows.looks) if (!speciesIds.has(l.species)) errors.push('look species');
  for (const c of rows.compendiums) {
    const tabs = new Set(c.tabs.map((t) => t.id));
    if (tabs.size !== c.tabs.length || new Set(c.entries.map((e) => e.id)).size !== c.entries.length || c.entries.some((e) => !tabs.has(e.tab) || !speciesIds.has(e.species))) errors.push('compendium references');
  }
  return errors;
}
/** The independent JSON check runs before strict row schemas; functions/accessors/cycles never become data. */
export const RowsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only rows'), raw, v.check((rows) => rowRules(rows).length === 0, 'row reference rules'));
/** Validate rows at the author boundary, before JSON serialization can erase closures. */
export function parseRows(input: unknown): ShardRows { return v.parse(RowsSchema, input); }
/** Resolve both species and variant, preserving authored health and gameplay multipliers. */
export function speciesResolver(rows: ShardRows): (speciesId: string, variantId: string) => AnimalSimSpec {
  const catalogue = new Map(rows.species.map((row) => [row.id, row]));
  return (speciesId, variantId) => {
    const row = catalogue.get(speciesId), selected = row?.variants.find((variantRow) => variantRow.id === variantId);
    if (row === undefined || selected === undefined) throw new Error('Unresolved declared species/variant');
    return { kind: row.kind, label: selected.label, variant: selected.id, rarity: selected.rarity, hp: selected.hp, aggressive: row.aggressive, lockable: row.lockable,
      dims: { ...row.dims, feet: row.dims.feet.map(([x, z]) => [x, z]) }, mods: { ...selected.mods }, ...(row.flight === undefined ? {} : { flight: { ...row.flight } }) };
  };
}
/** Numeric strike rows feed the authoritative sim without a score callback. */
export function simStrikes(rows: ShardRows): ReadonlyMap<string, SimStrike> {
  return new Map(rows.strikes.map(({ weight: _weight, speed, ...row }) => [row.id, { ...row, motion: { speed } }]));
}
/** Legacy strike scoring is an engine-owned constant adapter over the declared weight. */
export function scoredStrikes(rows: ShardRows): readonly StrikeSpec[] {
  const numeric = simStrikes(rows);
  return rows.strikes.map((row) => { const spec = numeric.get(row.id); if (spec === undefined) throw new Error('Missing strike'); return { ...spec, weight: () => row.weight }; });
}
