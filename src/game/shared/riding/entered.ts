import type { Scope } from '@wildshard/engine/app/scope';
import type { Mount } from '../../client/riding/mount';

const enteredMounts = new WeakMap<Scope, Mount>();
/** A scope's mount, until the scope ends or the one it replaced comes back. */
export function enterMount(scope: Scope, mount: Mount): void {
  const previous = enteredMounts.get(scope);
  enteredMounts.set(scope, mount);
  scope.onDispose(() => {
    if (enteredMounts.get(scope) !== mount) return;
    if (previous === undefined) enteredMounts.delete(scope); else enteredMounts.set(scope, previous);
  });
}
/** Borrow the native entered mount without constructing a riding controller. */
export function enteredMount(scope: Scope): Mount | undefined { return scope.disposed ? undefined : enteredMounts.get(scope); }
/** Population reads the actual mount, including before riding is installed. */
export function pageRidingMounted(context: { readonly scope: Scope }): boolean { return enteredMount(context.scope)?.mounted === true; }
