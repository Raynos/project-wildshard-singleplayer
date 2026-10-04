/** Native frame scheduling and diagnostic target classification are injected by the browser entry. */
export interface ScopeEnvironment {
  targetKind: (target: EventTarget) => 'window' | 'document' | 'canvas' | 'other';
  frame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
}
let environment: ScopeEnvironment = {
  targetKind: () => 'other', frame: () => { throw new Error('Frame scheduling is unavailable in this host'); },
  cancelFrame: () => { /* No browser frame exists in a bare host. */ },
};
/** Install native presentation services explicitly; simulation scopes retain ownership without them. */
export function installScopeEnvironment(value: ScopeEnvironment): void { environment = value; }
export function scopeEnvironment(): ScopeEnvironment { return environment; }
