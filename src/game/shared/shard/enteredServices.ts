import type { Scope } from '@wildshard/engine/app/scope';

type EnteredServices = (install: (scope: Scope) => void) => void;

/** The contexts that retain their home resources while entered services are independently scoped, with each one's
 * service registration. retainedHooks.ts fills it; a shared reader only asks whether a context is here. */
export const enteredServices: WeakMap<object, EnteredServices> = new WeakMap<object, EnteredServices>();
