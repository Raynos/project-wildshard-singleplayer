export function accuracyRecorder() {
      const state = { samples: [], final: null, readyAt: 0, firstAt: -1, last: '', lastSampleAt: 0, updates: [], errors: [], resources: [], workerReceipts: [] };
      Reflect.set(window, '__loadingAccuracy', state);
      navigator.serviceWorker.addEventListener('message', event => {
        if (!state.readyAt && ['WS_BACKGROUND_DOWNLOAD', 'WS_WORKER_DOWNLOAD'].includes(event.data?.type)) state.workerReceipts.push(event.data);
      });
      new PerformanceObserver(list => {
        if (!state.readyAt) for (const entry of list.getEntries()) state.resources.push(entry.toJSON());
      }).observe({ type: 'resource', buffered: true });
      window.addEventListener('error', event => { if (state.errors.length < 100) state.errors.push(event.message); });
      window.addEventListener('unhandledrejection', event => { if (state.errors.length < 100) state.errors.push(String(event.reason)); });
      const read = () => {
        const root = document.querySelector('.ws-load');
        if (!(root instanceof HTMLElement) || Object.hasOwn(root.dataset, 'shell') || state.readyAt) return;
        const now = performance.now();
        if (state.firstAt < 0) state.firstAt = now;
        const text = key => root.querySelector(`[data-el="${key}"]`)?.textContent ?? '';
        const rows = [...root.querySelectorAll('[data-el="rows"] > div')].map(row => ({
          label: row.children.item(0)?.textContent ?? '', detail: row.children.item(1)?.textContent ?? '',
          duration: row.children.item(2)?.textContent ?? '', state: row.className,
          key: row.dataset.key, ms: row.dataset.ms,
        }));
        const sample = { at: now, clock: text('clock'), detail: text('suFact'), download: text('dlFact'), footer: text('foot'), diagnostics: text('diagnostics'),
          waiting: root.dataset.waiting, filesInFlight: root.dataset.filesInFlight, stalled: root.dataset.stalled,
          path: root.dataset.path, step: root.dataset.step, setup: root.dataset.setup,
          networkBytes: root.dataset.networkBytes, cachedBytes: root.dataset.cachedBytes,
          pendingBytes: root.dataset.pendingBytes, rows };
        const detailed = `${sample.detail}|${sample.footer}|${rows.map(row => row.detail).join('|')}`;
        const changed = detailed !== state.last;
        if (changed) { state.updates.push(now); state.last = detailed; }
        if (changed || now - state.lastSampleAt >= 250) { state.samples.push(sample); state.lastSampleAt = now; }
        state.final = sample;
        if (root.classList.contains('hide')) state.readyAt = now;
      };
      setInterval(read, 250);
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(read).observe(document.documentElement, {
          attributes: true, subtree: true, childList: true, characterData: true, attributeFilter: ['class'],
        });
      });
    }
