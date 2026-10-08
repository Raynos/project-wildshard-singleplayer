// @vitest-environment happy-dom
import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the exact serialized browser capture fixture.
import { runInNewContext } from 'node:vm';
// oxlint-disable-next-line import/default -- Vite raw source is the actual serializable script.
import source from '../../scripts/debug-settings.mjs?raw';

it('hides late-mounted Developer overlays without removing their diagnostics or hiding gameplay and load failures', () => {
  const context: Record<string, unknown> = { document };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const helper = context['hideDeveloperOverlays'];
  if (typeof helper !== 'function') throw new Error('Capture overlay fixture missing');
  const hide = helper as () => void;
  hide(); document.dispatchEvent(new Event('DOMContentLoaded'));
  const host = document.createElement('div');
  const classes = ['ws-perf', 'ws-perf-panel', 'ws-game-developer', 'ws-game-dev-alert', 'ws-grid-budget', 'ws-memory-warning', 'ws-game-boundary', 'ws-load-error', 'ws-game-health'];
  const nodes = classes.map((className) => { const node = document.createElement('div'); node.className = className; node.textContent = className; host.append(node); return node; });
  document.body.append(host);
  try {
    for (const node of nodes) {
      expect(getComputedStyle(node).visibility).toBe(classes.slice(0, 7).includes(node.className) ? 'hidden' : '');
      expect(node.isConnected).toBe(true);
      expect(node.textContent).toBe(node.className);
      expect(node.hidden).toBe(false);
    }
  } finally { host.remove(); document.getElementById('parity-developer-overlays')?.remove(); }
});
