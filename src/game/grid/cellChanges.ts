/** Scoped change subscriptions for mutable Three values; no Three prototype edits or frame census. */
interface Slot { value: unknown; readonly initial: unknown; readonly listeners: Set<() => void>; fast: (() => void) | undefined; get: () => unknown; readonly prior: PropertyDescriptor | undefined }
const FIELDS = Symbol('cell change fields');
interface FieldState { readonly values: Record<string, Slot | undefined>; size: number }
interface FieldOwner { [FIELDS]?: FieldState }
/** Observe an own data field. The getter reads its slot directly;
 * a sole subscriber delivers without allocating an array on each change. */
export function onCellField(target: object, key: string, changed: () => void): () => void {
  const owner: FieldOwner = target;
  let fields = owner[FIELDS];
  if (fields === undefined) {
    const values: Record<string, Slot | undefined> = {}; Reflect.setPrototypeOf(values, null);
    fields = { values, size: 0 }; Object.defineProperty(owner, FIELDS, { configurable: true, value: fields });
  }
  let slot = fields.values[key];
  if (slot === undefined) {
    const prior = Object.getOwnPropertyDescriptor(target, key);
    if (prior !== undefined && (prior.configurable !== true || !('value' in prior))) throw new Error(`Cell change field is not writable data: ${key}`);
    const initial: unknown = prior === undefined ? Reflect.get(target, key) : prior.value;
    const made: Slot = { value: initial, initial, listeners: new Set(), fast: undefined, prior, get: () => undefined };
    made.get = () => made.value;
    Object.defineProperty(target, key, { configurable: true, enumerable: prior?.enumerable ?? true, get: made.get,
      set(value: unknown): void {
        if (made.value === value) return;
        made.value = value;
        if (made.fast !== undefined) made.fast();
        else { const delivery = [...made.listeners]; for (const notify of delivery) if (made.listeners.has(notify)) notify(); }
      } });
    fields.values[key] = made; fields.size++; slot = made;
  }
  const table = fields, held = slot; held.listeners.add(changed); held.fast = held.listeners.size === 1 ? changed : undefined;
  return () => {
    if (!held.listeners.delete(changed)) return;
    held.fast = held.listeners.size === 1 ? held.listeners.values().next().value : undefined;
    if (held.listeners.size > 0) return;
    if (Object.getOwnPropertyDescriptor(target, key)?.get === held.get) {
      if (held.prior === undefined && held.value === held.initial) Reflect.deleteProperty(target, key);
      else Object.defineProperty(target, key, { ...held.prior, configurable: true, writable: true, value: held.value });
    }
    delete table.values[key]; table.size--;
    if (table.size === 0) Reflect.deleteProperty(owner, FIELDS);
  };
}

interface MethodSlot { readonly prior: PropertyDescriptor | undefined; readonly call: (...args: unknown[]) => unknown; readonly listeners: Set<(...args: readonly unknown[]) => void> }
const methods = new WeakMap<object, Map<string, MethodSlot>>();
/** Explicit matrix/collection mutations emit once after their native operation completes. */
export function onCellMethods(target: object, keys: readonly string[], changed: (...args: readonly unknown[]) => void): () => void {
  let entries = methods.get(target);
  if (entries === undefined) { entries = new Map(); methods.set(target, entries); }
  const undo: (() => void)[] = [];
  for (const key of keys) {
    let slot = entries.get(key);
    if (slot === undefined) {
      const original: unknown = Reflect.get(target, key);
      if (typeof original !== 'function') continue;
      const listeners = new Set<(...args: readonly unknown[]) => void>();
      slot = { prior: Object.getOwnPropertyDescriptor(target, key), listeners,
        call: (...args: unknown[]): unknown => { const value: unknown = Reflect.apply(original, target, args); for (const notify of listeners) notify(...args); return value; } };
      Object.defineProperty(target, key, { configurable: true, writable: true, value: slot.call });
      entries.set(key, slot);
    }
    const held = slot; held.listeners.add(changed);
    undo.push(() => {
      if (!held.listeners.delete(changed) || held.listeners.size > 0) return;
      if (Reflect.get(target, key) === held.call) { if (held.prior === undefined) Reflect.deleteProperty(target, key); else Object.defineProperty(target, key, held.prior); }
      entries.delete(key); if (entries.size === 0) methods.delete(target);
    });
  }
  return () => { for (const restore of undo) restore(); };
}
