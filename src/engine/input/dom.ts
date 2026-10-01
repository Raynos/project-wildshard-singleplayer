import type { Scope } from '../app/scope';

type DomEvent<K extends string> = K extends keyof (GlobalEventHandlersEventMap & WindowEventMap) ? (GlobalEventHandlersEventMap & WindowEventMap)[K] : Event;
/** Scoped widget gestures keep DOM event typing and dispose with their owner. Gameplay uses actions. */
export function listenDom<K extends string>(scope: Scope, target: EventTarget | null | undefined, type: K, fn: (event: DomEvent<K>) => void, options?: boolean | AddEventListenerOptions): void {
  if (target === null || target === undefined) return;
  scope.listen(target, type, (event) => { fn(event); }, typeof options === 'boolean' ? { capture: options } : options);
}
export function mountDom(scope: Scope, parent: HTMLElement, ...nodes: HTMLElement[]): void {
  parent.append(...nodes);
  for (const node of nodes) scope.ownNode(node);
}
