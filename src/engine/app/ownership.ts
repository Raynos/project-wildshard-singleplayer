import type { Scope } from './scope';

/** Explicit synchronous construction owner; callbacks re-enter their registering Scope. */
let owner: Scope | null = null;
export function currentOwner(): Scope | null { return owner; }
export function enterOwner(next: Scope | null): void { owner = next; }
export function withOwner<T>(scope: Scope | null, fn: () => T): T {
  const previous = owner; owner = scope;
  try { return fn(); } finally { owner = previous; }
}
export function asShell<T>(fn: () => T): T { return withOwner(null, fn); }
export function onOwnerDispose(fn: () => void): void { owner?.onDispose(fn); }
