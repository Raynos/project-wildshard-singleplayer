import { installScopeEnvironment } from '../scopeEnvironment';

/** Called by the page composition root before a scope registers browser work. */
export function installBrowserScopeEnvironment(): void {
  installScopeEnvironment({
    targetKind: (target) => typeof window !== 'undefined' && target === window ? 'window'
      : typeof document !== 'undefined' && target === document ? 'document'
        : typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement ? 'canvas' : 'other',
    frame: (render) => requestAnimationFrame(render), cancelFrame: (id) => cancelAnimationFrame(id),
  });
}
