/**
 * sp-o13: the opt-in in-page task clock (`frame-floor.mjs --task-clock`, diagnostic only, no timing credit).
 *
 * WebKit's Timeline returns zero clocks on the iOS Simulator (progress/frame-floor/sp-o3-attribution-2026-10-12), and most
 * Simulator travel long frames carry neither GL time nor rAF work. Low game work and zero GL do not prove that JS ran
 * between frames (sp-x1): this clock records task spans so a long frame can be told apart as busy (callbacks executing),
 * unavailable (a gap no wrapped task covers) or display scheduling (tasks keep starting and ending on time while rAF is
 * late).
 *
 * It wraps the page's task entry points (timers, rAF, `message` listeners and `onmessage` on ports and workers). Each
 * task keeps `[startMs, syncMs, totalMs, end, kind, site]`:
 * - `syncMs`: the callback's own synchronous execution, exact.
 * - `totalMs`: until the next wrapped task starts (`end` 't') or a message posted when the callback returned arrives
 *   (`end` 'e'), whichever is first. The echo runs after the task's microtask checkpoint, so an async builder's
 *   continuation (an `await buildYield()` resuming) is inside `totalMs`. Both ends are upper bounds: `totalMs` can
 *   include queueing behind unwrapped work (network, decode), so it is busy time only where `syncMs` or a stack shows it.
 * - `site`: an index into `sites`: the stack where the callback was scheduled (or its listener added), then `<=` and
 *   the site of the task that scheduled it, up to three hops, so a paced frame wait (`nextDrawnFrame`: rAF, then a
 *   message) still names the builder that asked for it. Frames are bundle locations; the build's source maps resolve them.
 * Tasks under `minMs` total are dropped; the rest is enough to see timer continuity across a late rAF.
 */
export function installTaskClock(minMs = 4, cap = 20000) {
  const W = window;
  if (typeof W.__frameFloorTaskTake === 'function') return;
  let tasks = [], sites = [], siteIds = new Map(), open = null, current = '', serial = 0, dropped = 0;
  const now = () => performance.now();
  const round = (ms) => Math.round(ms * 10) / 10;
  const frames = (stack) => String(stack ?? '').split('\n').map((line) => line.trim())
    .filter((line) => line !== '' && !line.includes('__ffTask') && !line.startsWith('Error')).slice(0, 5).join(' | ');
  const site = () => {
    const own = frames(new Error('__ffTask').stack);
    const hops = current.split(' <= ').slice(0, 2).join(' <= ');
    return hops === '' ? own : `${own} <= ${hops}`;
  };
  const siteId = (text) => {
    let id = siteIds.get(text);
    if (id === undefined) { id = sites.length; sites.push(text); siteIds.set(text, id); }
    return id;
  };
  const close = (at, end) => {
    if (open === null) return;
    const total = at - open.start;
    if (total >= minMs) {
      if (tasks.length < cap) tasks.push([round(open.start), round(open.sync), round(total), end, open.kind, siteId(open.site)]);
      else dropped++;
    }
    open = null; current = '';
  };
  const echo = new MessageChannel();
  // a late echo must not close the task that started after its own
  echo.port1.onmessage = (event) => { if (open !== null && open.id === event.data) close(now(), 'e'); };
  const enter = (kind, at) => { close(now(), 't'); open = { id: ++serial, start: now(), sync: 0, kind, site: at }; current = at; };
  const leave = () => { if (open === null) return; open.sync = now() - open.start; echo.port2.postMessage(open.id); };
  const wrap = (kind, fn, at) => function wrapped(...args) { enter(kind, at); try { return fn.apply(this, args); } finally { leave(); } };
  const timeout = Reflect.get(W, 'setTimeout');
  W.setTimeout = function setTimeout(fn, ms, ...rest) { return timeout.call(W, typeof fn === 'function' ? wrap('timeout', fn, site()) : fn, ms, ...rest); };
  const raf = Reflect.get(W, 'requestAnimationFrame');
  if (typeof raf === 'function') W.requestAnimationFrame = function requestAnimationFrame(fn) { return raf.call(W, wrap('raf', fn, site())); };
  const listeners = new WeakMap();
  const targetPrototype = EventTarget.prototype;
  const add = Reflect.get(targetPrototype, 'addEventListener'), remove = Reflect.get(targetPrototype, 'removeEventListener');
  const messageTarget = (target) => target instanceof MessagePort || (typeof Worker === 'function' && target instanceof Worker);
  targetPrototype.addEventListener = function addEventListener(type, listener, options) {
    if (type !== 'message' || typeof listener !== 'function' || !messageTarget(this) || this === echo.port1) { add.call(this, type, listener, options); return; }
    let wrapped = listeners.get(listener);
    if (wrapped === undefined) { wrapped = wrap('message', listener, site()); listeners.set(listener, wrapped); }
    add.call(this, type, wrapped, options);
  };
  targetPrototype.removeEventListener = function removeEventListener(type, listener, options) {
    remove.call(this, type, (typeof listener === 'function' ? listeners.get(listener) : undefined) ?? listener, options);
  };
  for (const proto of [MessagePort.prototype, ...(typeof Worker === 'function' ? [Worker.prototype] : [])]) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'onmessage');
    const read = descriptor === undefined ? undefined : Reflect.get(descriptor, 'get'), write = descriptor === undefined ? undefined : Reflect.get(descriptor, 'set');
    if (descriptor === undefined || typeof read !== 'function' || typeof write !== 'function') continue;
    Object.defineProperty(proto, 'onmessage', { configurable: true, enumerable: descriptor.enumerable,
      get: function get() { return read.call(this); },
      set: function set(fn) { write.call(this, typeof fn === 'function' && this !== echo.port1 ? wrap('message', fn, site()) : fn); } });
  }
  /** The tasks since the last take (the open one closed now) and the site table they index. */
  W.__frameFloorTaskTake = () => {
    close(now(), 'e');
    const out = { minMs, columns: ['startMs', 'syncMs', 'totalMs', 'end', 'kind', 'site'], dropped, tasks, sites };
    tasks = []; sites = []; siteIds = new Map(); dropped = 0;
    return out;
  };
}

export const TASK_CLOCK_SCRIPT = `(${installTaskClock.toString()})();`;
