import { readLoadingReport } from '../admin-data/validate.mjs';

/** Match the real picker policy: prototypes/experimental cards require Developer; only the template uses its data entry. */
export function safariEntryPolicy(shard) {
  if (!['driftwood-isle', 'nalati-grasslands', 'pine-hollow', '_template', 'far-reach', 'sunscar-dunes', 'nine-dragon-stack'].includes(shard)) throw new Error('Unknown benchmark shard');
  const compiled = shard === '_template';
  return { developer: compiled || ['far-reach', 'sunscar-dunes', 'nine-dragon-stack'].includes(shard), entry: compiled ? 'shardfile' : 'legacy', selector: compiled ? '.ws-menu-shardfile' : '.ws-menu-play' };
}

/** The exported HTML runs this before game modules, including after Safari process swaps.
 * No prototype patches, scene walks or production bundle changes. */
export function safariRecorder() {
  const data = { origin: performance.timeOrigin, installedAt: performance.now(), url: location.href, steps: [], gaps: [], tasks: [], errors: [], ready: 0, play: 0,
    observerSupported: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask') };
  window.__sf67 = data;
  window.addEventListener('error', event => { data.errors.push({ at: performance.now(), message: event.message }); });
  window.addEventListener('unhandledrejection', event => { data.errors.push({ at: performance.now(), message: String(event.reason) }); });
  if (data.observerSupported) new PerformanceObserver(list => {
    for (const entry of list.getEntries()) data.tasks.push({ at: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
  let last = '', previous = 0, faded = 0;
  const read = () => {
    const panel = document.querySelector('.ws-load');
    if (!panel) return;
    const text = key => panel.querySelector(`[data-el="${key}"]`)?.textContent ?? '';
    const row = { phase: panel.dataset.step ?? '', download: panel.dataset.download ?? '', setup: panel.dataset.setup ?? '', name: text('slug'), tier: text('tier'), clock: text('clock'), bytes: text('dlFact'), detail: text('suFact'), wait: text('line') };
    const signature = JSON.stringify(row);
    if (signature !== last) { last = signature; data.steps.push({ at: performance.now(), ...row }); }
    if (!data.ready && row.download === '100' && row.setup === '100') data.ready = performance.now();
  };
  const mount = () => { new MutationObserver(read).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); read(); };
  mount();
  const frame = now => {
    if (previous && now - previous > 50) data.gaps.push({ at: previous, duration: now - previous });
    previous = now;
    const shown = [...document.querySelectorAll('.ws-load')].some(panel => getComputedStyle(panel).display !== 'none' && Number(getComputedStyle(panel).opacity) > 0.05);
    if (data.ready && !shown && window.__wildshard?.world) { if (++faded === 2) data.play = now; } else faded = 0;
    if (!data.play) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Never put rAF gaps into a long-task field: they include scheduling and GPU waits.
 * Missing Safari task durations/owners remain missing even when phase clocks are valid. */
export function safariReport(pin, captures) {
  const missing = ['Simulator Safari uses the Mac CPU/GPU; these are not physical iPhone timings.'];
  const runs = [];
  for (const capture of captures) {
    const label = `${capture.shard}-${capture.cache}`, data = capture.data;
    if (capture.status !== 'ok' || !data || !(data.play > 0)) { missing.push(`${label}: ${capture.status}; no accepted playable result.`); continue; }
    const offset = data.origin - capture.tapEpoch;
    if (!Number.isFinite(offset) || offset < 0 || !data.url.includes(`chunk=${capture.shard}`)) throw new Error(`Invalid Safari document fence: ${label}`);
    const end = offset + data.play, starts = [{ name: 'navigation', at: 0 }];
    for (const step of data.steps) if (step.phase && step.phase !== starts.at(-1).name) starts.push({ name: step.phase, at: offset + step.at });
    const phases = starts.filter(step => step.at < end).map((step, index, rows) => ({ name: step.name, startMs: step.at, endMs: rows[index + 1]?.at ?? end, owner: `loading phase: ${step.name} (wall time, not CPU attribution)` }));
    const longTasks = data.observerSupported ? data.tasks.filter(task => task.duration > 50 && task.at < data.play).map(task => ({ startMs: offset + task.at, durationMs: task.duration, owner: 'unattributed: Safari long-task observer has no sampled app owner' })) : [];
    missing.push(`${label}: Safari Inspector timeline/profile is retained separately; task ownership requires valid temporal samples.`);
    if (!data.observerSupported) missing.push(`${label}: long-task observer unavailable; rAF gaps are separate evidence, not zero tasks.`);
    runs.push({ shard: capture.shard, cache: capture.cache, timeToPlayableMs: end, phases, longTasks });
  }
  return readLoadingReport({ schema: 'loading-benchmark/1', pin, device: 'iOS Simulator Safari / portrait iPhone / native speed', runs, missing });
}
