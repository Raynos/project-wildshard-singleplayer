export function accuracyRecorder() {
      const state = { samples: [], final: null, readyAt: 0, last: '', updates: [], errors: [] };
      Reflect.set(window, '__loadingAccuracy', state);
      window.addEventListener('error', event => { if (state.errors.length < 100) state.errors.push(event.message); });
      window.addEventListener('unhandledrejection', event => { if (state.errors.length < 100) state.errors.push(String(event.reason)); });
      const read = () => {
        const root = document.querySelector('.ws-load');
        if (!(root instanceof HTMLElement) || Object.hasOwn(root.dataset, 'shell') || state.readyAt) return;
        const now = performance.now();
        const text = key => root.querySelector(`[data-el="${key}"]`)?.textContent ?? '';
        const rows = [...root.querySelectorAll('[data-el="rows"] > div')].map(row => ({
          label: row.children.item(0)?.textContent ?? '', detail: row.children.item(1)?.textContent ?? '',
          duration: row.children.item(2)?.textContent ?? '', state: row.className,
          key: row.dataset.key, ms: row.dataset.ms,
        }));
        const sample = { at: now, clock: text('clock'), detail: text('suFact'), download: text('dlFact'),
          path: root.dataset.path, step: root.dataset.step, setup: root.dataset.setup,
          networkBytes: root.dataset.networkBytes, cachedBytes: root.dataset.cachedBytes,
          pendingBytes: root.dataset.pendingBytes, rows };
        const detailed = `${sample.detail}|${rows.map(row => `${row.detail}:${row.duration}`).join('|')}`;
        if (detailed !== state.last) { state.updates.push(now); state.last = detailed; }
        state.samples.push(sample); state.final = sample;
        if (root.classList.contains('hide')) state.readyAt = now;
      };
      setInterval(read, 250);
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          if (document.querySelector('.ws-load.hide')) read();
        }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
      });
    }
