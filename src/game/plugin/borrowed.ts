/** A borrowed object capability, with an explicitly bounded property path. */
export interface BorrowedOwnerPath { readonly owner: string; readonly path: readonly (string | number)[]; readonly optional?: boolean }
/** The resolved field and its actual receiver; methods retain that receiver when lent to another host. */
export interface BorrowedOwnerValue { readonly receiver: Record<string, unknown>; readonly key: string; readonly value: unknown }
const borrowedRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
/** Resolve only a supplied owner. Refuse traversal, prototype keys and missing fields; optional null intermediates stay absent. */
export function readBorrowedOwner(owners: ReadonlyMap<string, unknown>, row: BorrowedOwnerPath): BorrowedOwnerValue | null {
  if (row.path.length === 0 || row.path.length > 16 || row.owner.length === 0 || row.owner.length > 96) throw new Error('Invalid borrowed owner path');
  for (const part of row.path) {
    if (typeof part === 'number' ? !Number.isSafeInteger(part) || part < 0 || part > 1024
      : !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(part) || ['constructor', 'prototype', '__proto__', 'caller', 'callee', 'arguments'].includes(part)) throw new Error('Unsafe borrowed owner path');
  }
  if (!owners.has(row.owner)) throw new Error(`Missing borrowed owner ${row.owner}`);
  let receiver = owners.get(row.owner);
  for (let index = 0; index < row.path.length; index++) {
    if (receiver === null || receiver === undefined) {
      if (row.optional === true) return null;
      throw new Error(`Missing borrowed field ${row.owner}`);
    }
    if (!borrowedRecord(receiver)) throw new Error('Borrowed path must traverse objects');
    const key = String(row.path[index]), value = receiver[key], last = index === row.path.length - 1;
    // A class method may be inherited; fields and intermediate objects must belong to the supplied instance.
    if (!Object.hasOwn(receiver, key) && !(last && typeof value === 'function')) throw new Error(`Missing borrowed field ${key}`);
    if (last) return { receiver, key, value };
    receiver = value;
  }
  throw new Error('Invalid borrowed owner path');
}

/** Borrow a required method with its actual receiver; resolution itself invokes nothing. */
export function bindBorrowedMethod(owners: ReadonlyMap<string, unknown>, row: BorrowedOwnerPath): (...args: readonly unknown[]) => unknown {
  const field = readBorrowedOwner(owners, row);
  const callable = (value: unknown): value is (...args: readonly unknown[]) => unknown => typeof value === 'function';
  if (field === null || !callable(field.value)) throw new Error('Missing borrowed owner method');
  const method = field.value;
  return (...args) => method.call(field.receiver, ...args);
}
