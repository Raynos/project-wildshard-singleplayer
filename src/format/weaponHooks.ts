import * as v from 'valibot';
import { WEAPON_HOOK_PHASES } from './wireLimits';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const id = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const weaponId = v.pipe(v.string(), v.regex(/^weapon\.[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const fact = v.strictObject({ key, min: finite, max: finite });
const damage = v.strictObject({ event: id, phases: v.pipe(v.array(v.picklist(WEAPON_HOOK_PHASES)), v.minLength(1), v.maxLength(8)),
  facts: v.pipe(v.array(fact), v.maxLength(16)), min: finite, max: finite });
/** A shard's weapon-hook declaration: one admitted module, the weapons it answers for and its immutable parameters. */
export const WeaponHooksSchema = v.pipe(v.strictObject({
  id: key, entity: id, module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  weapons: v.pipe(v.array(v.strictObject({ weapon: weaponId, damage })), v.minLength(1), v.maxLength(16)),
}), v.check((data) => new Set(data.weapons.map((row) => row.weapon)).size === data.weapons.length
  && new Set(data.weapons.map((row) => row.damage.event)).size === data.weapons.length
  && data.weapons.every((row) => row.damage.min <= row.damage.max && new Set(row.damage.phases).size === row.damage.phases.length
    && new Set(row.damage.facts.map((f) => f.key)).size === row.damage.facts.length && row.damage.facts.every((f) => f.min <= f.max)),
'Unique, bounded weapon hook declarations'));
/** Validated weapon-hook data. */
export type WeaponHooksData = v.InferOutput<typeof WeaponHooksSchema>;
/** Validate before admission or allocation. */
export function parseWeaponHooks(input: unknown): WeaponHooksData { return v.parse(WeaponHooksSchema, input); }

