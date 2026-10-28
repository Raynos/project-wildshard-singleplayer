import type {Capture, Mark, Row} from './model.ts';
/** Executed before app scripts on every document, including tap-triggered navigation. */
export function instrument(flow: string): void {
  const epoch = (): number => performance.timeOrigin + performance.now();
  const key = 'phone-loading.tap';
  const tap = Number(sessionStorage.getItem(key));
  const data: Capture = {tap: tap > 0 ? tap : null, control: null, rows: [], measures: [], longTasks: [], frameGaps: [], errors: [], rowCoverage: 'visible-only'};
  Reflect.set(window, '__phoneLoading', data);
  const seen = new Map<string, Row>();
  const sample = (): void => {
    if (document.documentElement?.dataset['wsState'] === 'error') {
      data.fatal = document.querySelector('.ws-load-error')?.textContent ?? 'Application entered error state';
      data.stoppedAt ??= epoch();
      if (!data.errors.includes(data.fatal)) data.errors.push(data.fatal);
    }
    for (const root of document.querySelectorAll('.ws-load')) {
      const snapshot: unknown = Reflect.get(root, Symbol.for('engine.loading.snapshot'));
      if (typeof snapshot === 'object' && snapshot !== null && 'rows' in snapshot && Array.isArray(snapshot.rows)) {
        data.rowCoverage = 'native-all-rows';
        const values: readonly unknown[] = snapshot.rows;
        for (const value of values) {
          if (typeof value !== 'object' || value === null) continue;
          const row: Record<string, unknown> = Object.fromEntries(Object.entries(value));
          if (typeof row['key'] !== 'string' || typeof row['ms'] !== 'number') continue;
          const start = typeof row['startedAt'] === 'number' ? performance.timeOrigin + row['startedAt'] : null;
          const end = typeof row['endedAt'] === 'number' ? performance.timeOrigin + row['endedAt'] : null;
          seen.set(row['key'], {key: row['key'], label: String(row['label']), start, end, duration: row['ms'], wallMs: start !== null && end !== null ? end - start : null});
        }
      } else {
        for (const element of root.querySelectorAll<HTMLElement>('[data-key]')) {
          const name = element.dataset['key'];
          if (name === undefined) continue;
          const text = element.textContent ?? '';
          const duration = Number(element.dataset['ms']);
          seen.set(name, {key: name, label: text, start: null, end: null, duration: Number.isFinite(duration) ? duration : 0, wallMs: null});
        }
      }
    }
    data.rows = [...seen.values()];
  };
  const mark = (entry: PerformanceEntry): Mark => ({name: entry.name, start: performance.timeOrigin + entry.startTime,
    duration: entry.duration, detail: entry instanceof PerformanceMeasure ? entry.detail : null});
  for (const type of ['measure', 'longtask']) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) (type === 'measure' ? data.measures : data.longTasks).push(mark(entry));
    }).observe({type, buffered: true});
  }
  new MutationObserver(sample).observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
  const tapped = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const selector = flow === 'grid' ? '.ws-main-grid' : '.ws-menu-shardfile,.ws-menu-play';
    if (target.closest(selector) === null) return;
    if (data.tap !== null) return;
    data.tap = epoch(); sessionStorage.setItem(key, String(data.tap));
    const publish: unknown = Reflect.get(window, '__phoneLoadingTap');
    if (typeof publish === 'function') Reflect.apply(publish, window, [data.tap]);
  };
  window.addEventListener('pointerup', tapped, true);
  window.addEventListener('click', tapped, true);
  document.addEventListener('ws:control-ready', () => {sample(); data.control = epoch();}, {once: true});
  window.addEventListener('error', event => {data.errors.push(event.message);});
  window.addEventListener('unhandledrejection', event => {data.errors.push(String(event.reason));});
  let last = performance.now();
  const frame = (now: number): void => {
    if (now - last > 50) data.frameGaps.push({start: performance.timeOrigin + last, duration: now - last});
    last = now;
    if (data.control === null && data.fatal === undefined) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
