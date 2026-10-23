/** Reversible H4 group-bank transport. It owns no group, member, scheduler,
 * RNG or save. Reference loans are supplied afresh by the existing roster. */
import type { Scope } from '../app/scope';
import { parseGroupBankV2, groupBankWidthV2, type GroupBankReferenceV2,
  type GroupBankFieldV2, type GroupBankValueV2 } from '@wildshard/format/scriptGroupBankV2';

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite group bank value');
  return value;
}
function integer(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error('Invalid group bank index');
  return value;
}
/** Capture references only from actual native roster slots, including dead
 * members. A slot is removed only by the original owner's explicit despawn. */
function references(input: readonly GroupBankReferenceV2[]): ReadonlyMap<number, GroupBankReferenceV2> {
  if (input.length > 1024) throw new Error('Group reference capacity');
  const result = new Map<number, GroupBankReferenceV2>();
  const wires = new Set<string>(), identities = new Set<string>(), slots = new Set<string>();
  for (const row of input) {
    integer(row.handle, 1, 0x7fffffff);
    integer(row.slot, 0, 15);
    const slot = JSON.stringify([row.group, row.slot]);
    if (row.group.length === 0 || row.identity.length === 0 || row.wire.length === 0
      || result.has(row.handle) || wires.has(row.wire) || identities.has(row.identity) || slots.has(slot))
      throw new Error('Ambiguous group reference loan');
    result.set(row.handle, Object.freeze({ ...row }));
    wires.add(row.wire); identities.add(row.identity); slots.add(slot);
  }
  return result;
}
function ownValues(input: Readonly<Record<string, GroupBankValueV2>>, names: readonly string[]): void {
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('Invalid group bank record');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key)))
    throw new Error('Unexpected group bank field');
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(input, name);
    if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) throw new Error('Group bank accessor refused');
  }
}
/** A stateless codec; fields retain their declared order. The returned record
 * fits the original owner's snapshot assembly, rather than a new envelope. */
export class GroupBankV2 {
  private readonly fields: readonly GroupBankFieldV2[];
  readonly width: number;
  constructor(input: unknown) {
    this.fields = structuredClone(parseGroupBankV2(input));
    this.width = this.fields.reduce((sum, row) => sum + groupBankWidthV2(row), 0);
  }
  private loan(input: readonly GroupBankReferenceV2[], group: string): {
    readonly byHandle: ReadonlyMap<number, GroupBankReferenceV2>;
    readonly byWire: ReadonlyMap<string, GroupBankReferenceV2>;
  } {
    if (group.length === 0) throw new Error('Missing group identity');
    const byHandle = references(input);
    return { byHandle, byWire: new Map([...byHandle.values()].map(row => [row.wire, row])) };
  }
  encode(input: Readonly<Record<string, GroupBankValueV2>>, group: string,
    roster: readonly GroupBankReferenceV2[]): Float64Array {
    ownValues(input, this.fields.map(row => row.name));
    const { byWire } = this.loan(roster, group), bank = new Float64Array(this.width);
    let offset = 0;
    for (const row of this.fields) {
      const value = input[row.name];
      const reference = (wire: string): number => {
        const found = byWire.get(wire);
        if (found === undefined || row.kind !== 'reference' && row.kind !== 'references'
          || row.own === true && found.group !== group) throw new Error('Unresolved group reference');
        return found.handle;
      };
      switch (row.kind) {
        case 'number':
          if (typeof value !== 'number') throw new Error('Invalid numeric group field');
          finite(value);
          if (row.integer === true && !Number.isInteger(value) || row.min !== undefined && value < row.min
            || row.max !== undefined && value > row.max) throw new Error('Group field outside bound');
          bank[offset] = value;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') throw new Error('Invalid boolean group field');
          bank[offset] = Number(value);
          break;
        case 'enum': {
          if (typeof value !== 'string') throw new Error('Invalid enum group field');
          const index = row.values.indexOf(value);
          if (index === -1) throw new Error('Unknown group enum');
          bank[offset] = index;
          break;
        }
        case 'nullable-number':
          if (value !== null && typeof value !== 'number') throw new Error('Invalid nullable group field');
          bank[offset] = value === null ? 0 : 1;
          bank[offset + 1] = value === null ? 0 : finite(value);
          break;
        case 'reference':
          if (value !== null && typeof value !== 'string') throw new Error('Invalid group reference');
          bank[offset] = value === null ? 0 : reference(value);
          break;
        case 'references':
          if (!Array.isArray(value) || value.length > row.capacity || new Set(value).size !== value.length)
            throw new Error('Invalid ordered group references');
          bank[offset] = value.length;
          for (const [index, wire] of value.entries()) {
            if (typeof wire !== 'string') throw new Error('Invalid ordered group reference');
            bank[offset + index + 1] = reference(wire);
          }
          break;
        default: throw new Error('Unknown group bank field');
      }
      offset += groupBankWidthV2(row);
    }
    return bank;
  }
  decode(bank: ArrayLike<number>, group: string, roster: readonly GroupBankReferenceV2[]): Readonly<Record<string, GroupBankValueV2>> {
    if (bank.length !== this.width) throw new Error('Group bank width mismatch');
    const { byHandle } = this.loan(roster, group), result: Record<string, GroupBankValueV2> = {};
    let offset = 0;
    for (const row of this.fields) {
      const value = bank[offset];
      if (value === undefined) throw new Error('Missing group bank value');
      finite(value);
      const reference = (handle: number): string => {
        const found = byHandle.get(integer(handle, 1, 0x7fffffff));
        if (found === undefined || row.kind !== 'reference' && row.kind !== 'references'
          || row.own === true && found.group !== group) throw new Error('Unresolved group reference');
        return found.wire;
      };
      switch (row.kind) {
        case 'number':
          if (row.integer === true && !Number.isInteger(value) || row.min !== undefined && value < row.min
            || row.max !== undefined && value > row.max) throw new Error('Group field outside bound');
          result[row.name] = value;
          break;
        case 'boolean': result[row.name] = integer(value, 0, 1) === 1; break;
        case 'enum': {
          const selected = row.values[integer(value, 0, row.values.length - 1)];
          if (selected === undefined) throw new Error('Missing group enum');
          result[row.name] = selected;
          break;
        }
        case 'nullable-number': {
          const number = bank[offset + 1];
          if (number === undefined) throw new Error('Missing nullable group number');
          finite(number);
          if (integer(value, 0, 1) === 0 && !Object.is(number, 0)) throw new Error('Nonzero absent group value');
          result[row.name] = value === 0 ? null : number;
          break;
        }
        case 'reference': result[row.name] = value === 0 ? null : reference(value); break;
        case 'references': {
          const count = integer(value, 0, row.capacity), values: string[] = [];
          for (let index = 0; index < row.capacity; index++) {
            const handle = bank[offset + index + 1];
            if (handle === undefined) throw new Error('Missing ordered group reference');
            if (index < count) values.push(reference(handle));
            else if (!Object.is(handle, 0)) throw new Error('Nonzero unused group reference');
          }
          if (new Set(values).size !== values.length) throw new Error('Duplicate ordered group reference');
          result[row.name] = Object.freeze(values);
          break;
        }
        default: throw new Error('Unknown group bank field');
      }
      offset += groupBankWidthV2(row);
    }
    return Object.freeze(result);
  }

  /** Validate a complete detached candidate, then borrow one publication into
   * the original bank. A caller composes validate with its native effects/RNG
   * transaction before accept; no operation here steps an actor or a clock. */
  prepare(bank: Float64Array, candidate: ArrayLike<number>, group: string,
    roster: readonly GroupBankReferenceV2[], scope: Scope): {
      readonly values: Readonly<Record<string, GroupBankValueV2>>;
      readonly validate: () => void;
      readonly accept: () => void;
    } {
    if (candidate.length !== this.width || bank.length !== this.width || scope.disposed || scope.disposing) throw new Error('Retired group bank owner');
    this.decode(bank, group, roster);
    const before = bank.slice(), next = Float64Array.from(candidate);
    const values = this.decode(next, group, roster);
    const pins = roster.map(row => ({ source: row, group: row.group, slot: row.slot,
      identity: row.identity, wire: row.wire, handle: row.handle }));
    let accepted = false;
    const validate = (): void => {
      if (accepted || scope.disposed || scope.disposing) throw new Error('Retired group bank preparation');
      if (bank.length !== before.length || before.some((value, index) => !Object.is(value, bank[index])))
        throw new Error('Changed group bank owner');
      if (roster.length !== pins.length || pins.some((pin, index) => {
        const row = roster[index];
        return row !== pin.source || row.group !== pin.group || row.slot !== pin.slot
          || row.identity !== pin.identity || row.wire !== pin.wire || row.handle !== pin.handle;
      })) throw new Error('Changed group reference loan');
    };
    return { values, validate, accept: () => { validate(); bank.set(next); accepted = true; } };
  }
}
