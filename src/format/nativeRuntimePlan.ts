import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesBrainSchema } from './speciesBrain';
import { BossOwnerRowSchema } from './bossProfiles';
import { CreatureBodyRecipeSchema, CreatureStrikeSchema } from './creatures';
import { ScriptBindingsSchema } from './scripts';
import { StateSchema } from './state';

const number = v.pipe(v.number(), v.finite());
const count = v.pipe(number, v.integer(), v.minValue(0), v.maxValue(65535));
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const pair = v.tuple([number, number]);
const triple = v.tuple([number, number, number]);
// Body-home order is part of the existing diver continuation contract.
const home = v.strictObject({ x: number, z: number, r: number, y: number });
// Existing gameplay-only species attributes pass through unchanged. The outer
// JSON check refuses callbacks/accessors; the species owner admits its policy.
const variant = v.objectWithRest({ id: key, label: key, weight: number,
  rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), scale: pair }, v.unknown());
const species = v.objectWithRest({ id: key, kind: key, label: key,
  variants: v.pipe(v.array(variant), v.minLength(1), v.maxLength(64)),
  brain: v.exactOptional(SpeciesBrainSchema), body: v.exactOptional(CreatureBodyRecipeSchema) }, v.unknown());
const population = v.objectWithRest({ program: v.strictObject({
  species: v.pipe(v.array(species), v.maxLength(256)), strikes: v.pipe(v.array(CreatureStrikeSchema), v.maxLength(256)),
  modules: v.exactOptional(v.record(key, v.pipe(v.string(), v.maxLength(400000)))) }),
  step: key, seed: number, homes: v.pipe(v.array(v.strictObject({ id: key, kind: key, at: pair, yaw: number,
    respawn: number, look: v.exactOptional(key), late: v.exactOptional(v.union([v.boolean(), v.literal('ground')])) })), v.maxLength(4096)),
  boss: v.exactOptional(v.strictObject({ id: key, kind: key, at: pair, yaw: number, look: v.exactOptional(key) })),
  attackers: v.nullable(count), think: v.union([v.literal('legacy'), v.strictObject({ every: count, dt: number })]),
  killY: v.exactOptional(number), admission: v.picklist(['prepare', 'install']),
  placement: v.exactOptional(v.strictObject({ fallback: number, rows: v.pipe(v.array(v.strictObject({ id: key, fromY: number, home })), v.maxLength(4096)) })),
  holds: v.exactOptional(v.pipe(v.array(v.strictObject({ home: count, field: key, until: key })), v.maxLength(4096))) }, v.unknown());
const spot = v.strictObject({ id: key, x: number, y: number, z: number, radius: number });
const entry = v.strictObject({ lanes: count, walk: number, start: number, maxTicks: count,
  ramp: v.exactOptional(v.strictObject({ at: number, run: number, height: number, stride: number, look: number,
    halfWidths: v.strictObject({ north: number, east: number, south: number, west: number }) })) });
const motion = v.objectWithRest({ systemId: key, skipPrefix: v.exactOptional(key),
  composition: v.strictObject({ sim: v.strictObject({ bindings: ScriptBindingsSchema, scriptTickDivisor: count }),
    state: v.pick(StateSchema.pipe[0], ['shared', 'player']) }),
  rules: v.strictObject({ fields: v.record(key, pair), archetypes: v.pipe(v.array(count), v.maxLength(1024)),
    events: v.pipe(v.array(count), v.maxLength(1024)), maxEntities: count }),
  permissions: v.pipe(v.array(v.strictObject({ mover: key, flags: v.pipe(v.array(v.strictObject({ name: key, bit: count })), v.maxLength(16)) })), v.maxLength(64)),
}, v.unknown());
const recipe = v.strictObject({
  population: v.strictObject({ rows: population, sources: v.picklist(['actors', 'actors+bosses']), seed: v.picklist(['identity', 'declared']), owner: BossOwnerRowSchema }),
  terrain: v.picklist(['none', 'collider']), floor: v.exactOptional(v.literal('solids')),
  ground: v.strictObject({ size: number, height: number }),
  player: v.strictObject({ speed: number, lift: v.exactOptional(number), at: v.exactOptional(triple), yaw: v.exactOptional(number) }),
  motion: v.exactOptional(motion),
  runtime: v.strictObject({ weapon: v.strictObject({ id: key, stowOnBoard: v.exactOptional(v.boolean()), questWorld: v.exactOptional(v.boolean()), worldReactionAction: v.exactOptional(count) }),
    quest: v.strictObject({ spots: v.union([v.literal('metadata'), v.strictObject({ interact: v.pipe(v.array(spot), v.maxLength(4096)), crack: v.pipe(v.array(spot), v.maxLength(4096)) })]),
      crack: v.exactOptional(v.boolean()) }),
    columns: v.exactOptional(v.boolean()), entries: v.exactOptional(entry) }) });

/** Select the existing held-melee native interpreter using admitted data only.
 * Baked world metadata retains its owner-specific admission in that interpreter. */
export const NativeRuntimePlanSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Native runtime plan must be plain bounded JSON'),
  v.strictObject({ kind: v.literal('held-melee'), recipe, baked: v.unknown(),
    ownerInputs: v.exactOptional(v.pipe(v.array(key), v.maxLength(16))) }),
  v.check(row => row.ownerInputs === undefined || (new Set(row.ownerInputs).size === row.ownerInputs.length
    && row.ownerInputs.length === Object.keys(row.recipe.population.owner.stages.inputs).length
    && row.ownerInputs.every(name => Object.hasOwn(row.recipe.population.owner.stages.inputs, name))), 'Exact native owner input order'),
  v.transform(row => {
    // Canonical section JSON sorts object keys. Retain the authored director
    // input order explicitly because existing save contracts include that order.
    const owner = row.recipe.population.owner, ownerInputs = row.ownerInputs ?? Object.keys(owner.stages.inputs);
    const inputs = Object.fromEntries(ownerInputs.map(name => {
      const binding = owner.stages.inputs[name];
      if (binding === undefined) throw new Error('Missing native owner input');
      return [name, binding] as const;
    }));
    return { ...row, ownerInputs, recipe: { ...row.recipe, population: { ...row.recipe.population,
      owner: { ...owner, stages: { ...owner.stages, inputs } } } } };
  }));
export type NativeRuntimePlanData = v.InferOutput<typeof NativeRuntimePlanSchema>;
/** No module URL, callback, fallback or independent simulation owner is admitted. */
export function parseNativeRuntimePlan(input: unknown): NativeRuntimePlanData { return v.parse(NativeRuntimePlanSchema, input); }