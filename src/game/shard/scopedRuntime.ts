import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardRuntime } from './runtime';

const bound = new WeakMap<ShardRuntime, Scope>();
function read(object: object, key: PropertyKey): unknown { const value: unknown = Reflect.get(object, key); return value; }

/** Bind every staged runtime slot to this play scope, retaining the resident world's previous handoff on exit. */
export function bindScopedRuntime(parent: ShardRuntime, scope: Scope): ShardRuntime {
  if (scope.disposed) throw new Error('Cannot bind a disposed runtime scope');
  if (bound.has(parent)) throw new Error('Leave the previous runtime scope before binding another');
  const local: ShardRuntime = { ...parent, hooks: { ...parent.hooks }, objects: { ...parent.objects },
    interactables: [...parent.interactables], overhead: [...parent.overhead] };
  // The staged shell fills these borrowed services after world/kit. Its writes must remain visible on entry and exit;
  // a trusted hook's writes stay private to its local handoff instead of replacing the shell's current services.
  const borrowed = new Set<PropertyKey>(['world', 'step', 'play', 'viewer', 'horizonVeil']);
  const overrides = new Map<PropertyKey, unknown>();
  for (const key of borrowed) Object.defineProperty(local, key, { configurable: true, enumerable: true,
    get: () => overrides.has(key) ? overrides.get(key) : read(parent, key),
    set: (value: unknown) => { overrides.set(key, value); },
  });
  const keys = new Set([...Reflect.ownKeys(parent).filter((key) => !borrowed.has(key)), 'buildEquipment', 'menu']);
  const descriptors = new Map([...keys].map((key) => [key, Reflect.getOwnPropertyDescriptor(parent, key)]));
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(parent, key);
    if (descriptor?.configurable === false) throw new Error(`Runtime slot ${String(key)} must be scope-bindable`);
  }
  for (const key of keys) Object.defineProperty(parent, key, { configurable: true, enumerable: true,
    get: () => read(local, key), set: (value: unknown) => { Reflect.set(local, key, value); },
  });
  bound.set(parent, scope);
  scope.onDispose(() => {
    bound.delete(parent);
    for (const key of keys) {
      const descriptor = descriptors.get(key);
      if (descriptor === undefined) Reflect.deleteProperty(parent, key); else Object.defineProperty(parent, key, descriptor);
    }
  });
  return local;
}
