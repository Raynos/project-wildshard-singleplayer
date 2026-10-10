import * as v from 'valibot';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptSnapshot } from '@wildshard/engine/script/host';
import { ScriptWorld, SCRIPT_OP, type EffectTransaction, type ScriptEffect } from '@wildshard/engine/script/effects';
import { WEAPON_HOOK_PHASES, type WeaponDamageInput, type WeaponHooks } from '../systems/items/weaponHooks';

/**
 * Admitted weapon hooks (SHARD-PLATFORM SF36): a shard declares which weapons ask its AssemblyScript module for a number,
 * the facts each family supplies and the bounds of each answer; the game admits the module through the same ScriptHost
 * (ABI v0, fuel, memory, event and failure ceilings) as the shard's director and hands each weapon its `WeaponHooks`.
 *
 * The call's input slots (f64): 0 the call's tick, 1 dt (0), 2 the hook (1 = damage), 3 the module's entity, 4 the phase
 * (`WEAPON_HOOK_PHASES` index + 1), 5 the weapon (declaration order + 1), 6 the row's base damage, 7… the declared facts
 * in order. The answer is ONE event record `{ op 3, type: the weapon's declared event, target: the entity, value }`; any
 * other output, a trap, a fuel overrun or a value outside `[min, max]` (or not an integer) declines, and the family's own
 * rule applies. The declaration's `parameters` reach the module through the parameter query (410), like a director's.
 * A hook is a pure function of its inputs: the module's memory and globals return to their admitted state after every
 * call, so nothing about a hook needs saving or restoring.
 */

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

/** The hook selector in input slot 2. */
export const WEAPON_HOOK_DAMAGE = 1;

class WeaponHookWorld extends ScriptWorld {
  constructor(private readonly data: WeaponHooksData) {
    super({ fields: {}, archetypes: [], events: data.weapons.map((row) => row.damage.event), maxEntities: 1 },
      [{ id: data.entity, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (effects.length > 1 || effects.some((e) => e.op !== SCRIPT_OP.event || e.b !== self || !this.data.weapons.some((row) => row.damage.event === e.a))) throw new Error('Invalid weapon hook answer');
    return super.prepare(effects, self, spawns, events);
  }
}

/** One admitted weapon-hook module: `hooks(weaponId)` hands a declared weapon its bounded, pure hooks. */
export class WeaponHookLane {
  readonly data: WeaponHooksData;
  readonly host: ScriptHost;
  private readonly admitted: ScriptSnapshot;
  private tick = 0;
  constructor(data: WeaponHooksData, bytes: Uint8Array) {
    this.data = parseWeaponHooks(data);
    this.host = new ScriptHost({ world: new WeaponHookWorld(this.data), query: (kind, request, self) => {
      if (kind !== SCRIPT_PARAMETER_QUERY || self !== this.data.entity || request.length !== 8 || request.some((value) => value !== 0)) throw new Error('Weapon hooks query only their parameters');
      return [...this.data.parameters];
    } });
    this.host.install(this.data.module, bytes);
    this.admitted = this.host.snapshot(this.data.module);
  }
  /** Calls made so far (each is its own script tick). */
  get calls(): number { return this.tick; }
  /** The declared weapon's hooks; an undeclared weapon is refused. */
  hooks(weapon: string): WeaponHooks {
    const index = this.data.weapons.findIndex((row) => row.weapon === weapon), row = this.data.weapons[index];
    if (row === undefined) throw new Error(`Undeclared hooked weapon ${weapon}`);
    return { damage: (input) => this.damage(index, row, input) };
  }
  private damage(index: number, row: WeaponHooksData['weapons'][number], input: WeaponDamageInput): number | null {
    const phase = WEAPON_HOOK_PHASES.indexOf(input.phase);
    if (phase === -1 || !row.damage.phases.includes(input.phase) || !Number.isFinite(input.base)) return null;
    const facts: number[] = [];
    for (const f of row.damage.facts) {
      const value = input.facts[f.key];
      if (value === undefined || !Number.isFinite(value) || value < f.min || value > f.max) return null;
      facts.push(value);
    }
    this.host.beginTick(++this.tick);
    const call = this.host.call(this.data.module, this.data.entity, [this.tick, 0, WEAPON_HOOK_DAMAGE, this.data.entity, phase + 1, index + 1, input.base, ...facts]);
    // pure: whatever the call wrote, the next one starts from the admitted memory and globals
    if (call.ok) this.host.restore(this.data.module, this.admitted);
    const answer = call.ok && call.events.length === 1 ? call.events[0] : undefined;
    if (answer?.type !== row.damage.event || answer.target !== this.data.entity) return null;
    const value = answer.value;
    return Number.isInteger(value) && value >= row.damage.min && value <= row.damage.max ? value : null;
  }
}

/** Verify the immutable module bytes against the declaration's hash, then admit them. */
export async function createWeaponHookLane(data: WeaponHooksData, bytes: Uint8Array): Promise<WeaponHookLane> {
  const checked = parseWeaponHooks(data), copy = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
  if ([...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('') !== checked.module) throw new Error('Weapon hook module hash mismatch');
  return new WeaponHookLane(checked, copy);
}
