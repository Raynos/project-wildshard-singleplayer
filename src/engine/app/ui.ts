import type { Scope } from './scope';

/** Displayed UI state follows the active resident level. */
export class AppUi {
  private readonly prompts = new WeakMap<Scope, () => string>();
  private readonly active: () => Scope | null;
  constructor(active: () => Scope | null) { this.active = active; }
  bind(scope: Scope, prompt: () => string): void {
    this.prompts.set(scope, prompt);
    scope.onDispose(() => { this.prompts.delete(scope); });
  }
  prompt(): string {
    const scope = this.active();
    return scope === null ? '' : this.prompts.get(scope)?.() ?? '';
  }
}
