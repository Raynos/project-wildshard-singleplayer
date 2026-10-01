import { app } from '../app/runtime';
import type { Scope } from '../app/scope';
import { mountDom } from './dom';
import { engineString } from '../strings';

/** Harness-only readout; enabling it does not register input or change consumption. */
export function installInputTrace(scope: Scope): void {
  const input = app.input;
  const node = document.createElement('pre');
  node.hidden = true;
  node.style.cssText = 'position:absolute;top:100px;left:12px;max-width:calc(100% - 24px);max-height:55%;overflow:hidden;margin:0;padding:8px;background:#0d1b26e6;border:1px solid #8fe3ff;color:#8fe3ff;font:10px monospace;pointer-events:none;z-index:30';
  mountDom(scope, document.getElementById('hud') ?? document.body, node);
  const last20 = (): readonly { action: string; at: number }[] => input.recent.map((entry) => ({ ...entry }));
  const paint = (): void => {
    if (node.hidden === true) return;
    node.textContent = [engineString('s_bd514f3e7c07'), input.contexts.join(' > '), '', ...last20().map(({ action, at }) => [at.toFixed(3), action].join('  '))].join('\n');
  };
  scope.onDispose(app.debug.scopedExpose('input', Object.freeze({
    trace: (on: boolean): void => { node.hidden = !on; paint(); },
    last20,
    contexts: (): readonly string[] => [...input.contexts],
  })));
  app.addSystem({ id: 'engine.input.trace', phase: 'late', run: paint }, scope);
}
