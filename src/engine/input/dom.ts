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
/** the input events a page-wide listener may take (the set `wildshard/no-raw-input` guards) */
export type PageInputEvent = 'keydown' | 'keyup' | 'pointerdown' | 'pointerup' | 'pointermove' | 'pointercancel';
/**
 * A page-wide input listener (E362 AG18): a drag that leaves its widget, "a touch anywhere" that dismisses or skips,
 * a key a panel takes before the game does. The input layer owns every listener on the window or the document; code
 * outside it asks here, so `wildshard/no-raw-input` can refuse the raw form. `on` keeps the old target, because a
 * capture listener on the document runs after the window's.
 */
export function listenPage<K extends PageInputEvent>(scope: Scope, type: K, fn: (event: DomEvent<K>) => void, options?: AddEventListenerOptions & { on?: 'window' | 'document' }): void {
  const { on = 'window', ...rest } = options ?? {};
  scope.listen(on === 'document' ? document : window, type, fn, rest);
}
