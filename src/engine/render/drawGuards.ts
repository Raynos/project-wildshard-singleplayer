import type { Object3D } from 'three';
import type { Scope } from '../app/scope';
import type { Renderer } from './renderer';

type DrawArguments = Parameters<Renderer['renderBufferDirect']>;
/** Final admission after object/material callbacks, before any geometry is submitted. */
export type DrawGuard = (...args: DrawArguments) => boolean;
const GUARDS = Symbol('draw guard');
interface GuardedObject extends Object3D { [GUARDS]?: DrawGuard }
const subscribers = new WeakMap<Object3D, Set<DrawGuard>>();

/** A scoped refusal port; a false result prevents this submission, including shadow draws. */
export function guardObjectDraw(object: Object3D, guard: DrawGuard, scope: Scope): () => void {
  if (scope.disposed) return () => undefined;
  const target: GuardedObject = object;
  let entries = subscribers.get(object);
  if (entries === undefined) { entries = new Set(); subscribers.set(object, entries); }
  const held = entries;
  const publish = (): void => {
    if (held.size === 0) { Reflect.deleteProperty(target, GUARDS); subscribers.delete(object); return; }
    const first = held.values().next().value;
    const admit: DrawGuard | undefined = held.size === 1 ? first : (camera, scene, geometry, material, node, group) => {
      for (const check of held) if (!check(camera, scene, geometry, material, node, group)) return false;
      return true;
    };
    Object.defineProperty(target, GUARDS, { configurable: true, value: admit });
  };
  held.add(guard); publish();
  const remove = (): void => { if (held.delete(guard)) publish(); };
  const forget = scope.capture('disposers', remove);
  return () => { remove(); forget(); };
}

/** Final admission in the existing renderer port. Registration collapses a sole
 * subscriber ahead of time, with no new per-draw wrapper. */
export const admitObjectDraw: DrawGuard = (camera, scene, geometry, material, object, group) => {
  const target: GuardedObject = object, admit = target[GUARDS];
  return admit === undefined || admit(camera, scene, geometry, material, object, group);
};
