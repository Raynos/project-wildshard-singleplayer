/**
 * Lifecycle trace (E135): what the page did around an app switch, kept across reloads and sent home.
 *
 *   installLifeTrace(send);          // once, at boot (ErrorModal.installErrorModal): logs the boot, reports a boot that
 *                                    // followed a page which ended hidden or reloading (iOS killed it, or GpuRecovery reloaded)
 *   trace('hide', 'why');            // one line in the ring (GpuRecovery: hide / show / lost / restore / reload)
 *   traceReturn(awayMs);             // after a long absence: watch the next seconds of frames, then report the whole trace
 *
 * Why: Jake's iPhone home-screen app comes back from 10+ min in the background unpainted (E96, E135): white strips, a
 * shifted canvas, no HUD, garbage triangles, a still. Nothing on the Mac reproduces it, so the phone reports what
 * happened: which path ran (in-place wake, lost context, the away-reload), whether the next page booted, painted
 * (`paint` entries) and drew frames, and how the viewport looked. The report goes through the E133 error reporter as
 * system `lifecycle` (not an error: no chip, no modal), the trace in its stack field.
 *
 * localStorage `wsLifeTrace` (not `ws.`: the native save mirror copies every ws.* key), the newest TRACE_MAX lines.
 */
const KEY = 'wsLifeTrace';
const TRACE_MAX = 60;
/** an absence this long is worth a report on the way back */
export const REPORT_AWAY_MS = 60_000;
/** how long after a return (or a boot) the frames are watched before the report goes */
const WATCH_MS = 6000;
/** a previous page that ended this recently counts as "this boot followed it" */
const FOLLOW_MS = 30 * 60_000;

declare const __BUILD_ID__: string;

/** `message`, `trace`: the report (the error reporter's message / stack) */
export type LifeSend = (message: string, trace: string) => void;

const page = Math.random().toString(36).slice(2, 6);
const t0 = Date.now();
let send: LifeSend | null = null;

function read(): string[] {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

/** the layout right now: window, visual viewport, the game canvas's box, the page's visibility */
export function layout(): string {
  const vv = window.visualViewport;
  const c = document.getElementById('game');
  const r = c?.getBoundingClientRect();
  const box = r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : 'none';
  const v = vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${vv.scale.toFixed(2)}+${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)}` : '-';
  return `win ${innerWidth}x${innerHeight} vv ${v} canvas ${box} dpr ${devicePixelRatio} ${document.visibilityState}`;
}

export function trace(event: string, detail = ''): void {
  try {
    const d = new Date();
    const hms = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const line = `${hms} ${page} +${Math.round((Date.now() - t0) / 1000)}s ${event}${detail ? ` · ${detail}` : ''}`;
    const all = read();
    all.push(line);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-TRACE_MAX)));
  } catch { /* no storage: nothing to keep */ }
}

/** the paint entries this page has (first-paint / first-contentful-paint): none = the DOM never painted */
function paints(): string {
  try {
    const p = performance.getEntriesByType('paint').map((e) => `${e.name} ${Math.round(e.startTime)}ms`);
    return p.length > 0 ? p.join(', ') : 'no paint entries';
  } catch { return 'paint n/a'; }
}

/** count animation frames for `ms` (and the longest gap), then call back */
function watchFrames(ms: number, done: (frames: number, maxGap: number) => void): void {
  const start = performance.now();
  let last = start, frames = 0, maxGap = 0, finished = false;
  const finish = (): void => { if (!finished) { finished = true; done(frames, Math.round(maxGap)); } };
  const tick = (now: number): void => {
    if (finished) return;
    frames++;
    maxGap = Math.max(maxGap, now - last);
    last = now;
    if (now - start < ms) requestAnimationFrame(tick);
    else finish();
  };
  requestAnimationFrame(tick);
  // animation frames that stop (or never come) still report: that page is the finding
  window.setTimeout(() => { maxGap = Math.max(maxGap, performance.now() - last); finish(); }, ms + 1000);
}

function report(message: string): void {
  trace('report', message);
  // the server keeps the first MAX_STACK_CHARS (4000) of a stack: send the newest lines, which are the ones that matter
  try { send?.(message, `build ${__BUILD_ID__}\n${read().join('\n').slice(-3800)}`); } catch { /* reporting never throws */ }
}

/** back after `awayMs` hidden, the page woke in place (or is about to reload): trace the frames, report if it was long */
export function traceReturn(awayMs: number, path: string): void {
  trace('show', `away ${Math.round(awayMs / 1000)}s → ${path} · ${layout()}`);
  if (awayMs < REPORT_AWAY_MS) return;
  watchFrames(WATCH_MS, (frames, maxGap) => {
    trace('after return', `${frames} frames in ${WATCH_MS / 1000}s, longest gap ${maxGap}ms · ${layout()}`);
    report(`back after ${Math.round(awayMs / 60_000)} min: ${path}, ${frames} frames / ${WATCH_MS / 1000}s`);
  });
}

/** the world is built and the loop started (GpuRecovery's install) */
export function traceWorldReady(): void { trace('world ready', `${paints()} · ${layout()}`); }

/** once, at boot: log it; if the page before this one ended hidden or reloading, report how this boot went */
export function installLifeTrace(sendFn: LifeSend): void {
  if (send) return;
  send = sendFn;
  // the page before this one: its lines (a reload's own pagehide / show land after its `reload` line)
  const before = read();
  const pid = /^\S+ (\w+) /u.exec(before.at(-1) ?? '')?.[1] ?? '';
  const prevLines = before.filter((l) => l.split(' ')[1] === pid);
  let nav = '?';
  try { nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? '?'; } catch { /* old WebKit */ }
  trace('boot', `nav ${nav} · ${location.search || 'no query'} · ${layout()}`);
  // the page before ended while hidden (killed in the background) or on our own reload: this boot is the way back
  const eventOf = (l: string): string => l.split(' ')[3] ?? '';
  const last = prevLines.some((l) => eventOf(l) === 'reload') ? 'reload' : eventOf(prevLines.at(-1) ?? '');
  const endedAway = pid !== page && (last === 'hide' || last === 'reload');
  let recent = false;
  try { recent = Date.now() - Number(localStorage.getItem(`${KEY}At`) ?? 0) < FOLLOW_MS; } catch { /* no storage */ }
  const stamp = (): void => { try { localStorage.setItem(`${KEY}At`, String(Date.now())); } catch { /* no storage */ } };
  stamp();
  document.addEventListener('visibilitychange', stamp);
  window.addEventListener('pagehide', stamp);
  if (!endedAway || !recent) return;
  // give the boot time to reach the world, then say how far it got (a boot that never gets here is also the finding:
  // the next page's report will show a trace that ends in this boot)
  window.setTimeout(() => {
    watchFrames(WATCH_MS, (frames, maxGap) => {
      trace('after boot', `${frames} frames in ${WATCH_MS / 1000}s, longest gap ${maxGap}ms · ${paints()} · ${layout()}`);
      report(`boot after the last page ended on "${last}" (nav ${nav}): ${frames} frames / ${WATCH_MS / 1000}s`);
    });
  }, 20_000);
}
