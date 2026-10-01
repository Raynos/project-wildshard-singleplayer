import type { Scope } from '../app/scope';

type DomEvent<K extends string> = K extends keyof GlobalEventHandlersEventMap ? GlobalEventHandlersEventMap[K] : Event;
/** Scoped widget gestures keep DOM event typing and dispose with their owner. Gameplay uses actions. */
export function listenDom<K extends string>(scope: Scope, target: EventTarget, type: K, fn: (event: DomEvent<K>) => void, options?: boolean | AddEventListenerOptions): void {
  scope.listen(target, type, (event) => { fn(event as DomEvent<K>); }, typeof options === 'boolean' ? { capture: options } : options);
}
