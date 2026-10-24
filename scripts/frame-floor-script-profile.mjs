import { ensureWebKitPageClock } from './frame-floor-webkit-timeline.mjs';

/** Browser-serialized, clock-bounded steady window. No per-frame grid readout,
 * pose change, input injection, GC request or timing acceptance is involved. */
function steadyScriptWindow() {
  const api = window.__wildshard, world = api?.world, game = world?.game;
  if (!game || !world.hud.entered || world.hud.paused || !game.frameGate())
    throw new Error('Steady profile requires entered, unpaused controls');
  const startMs = performance.now(), firstFrame = game.frameCount;
  return new Promise((resolve, reject) => {
    let finished = false;
    /** @type {(() => void) | undefined} */
    let stop;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    // oxlint-disable-next-line prefer-const -- cleanup closes over the timer before its deadline callback can be installed
    let timer;
    /** @param {Error} [error] */
    const finish = (error) => {
      if (finished) return;
      finished = true; stop?.(); clearTimeout(timer);
      if (error) { reject(error); return; }
      const endMs = performance.now();
      resolve({ startMs, endMs, elapsedMs: endMs - startMs, frames: game.frameCount - firstFrame });
    };
    timer = setTimeout(() => finish(new Error('Steady profile received no completion frame within 30 seconds')), 30000);
    try {
      stop = game.watchFrames(() => {
        if (window.__wildshard !== api || api.world !== world || world.game !== game || !world.hud.entered || world.hud.paused) {
          finish(new Error('Steady profile world or controls changed')); return;
        }
        if (performance.now() - startMs >= 20000) finish();
      });
      if (finished) stop?.();
    } catch (error) { finish(error instanceof Error ? error : new Error('Steady profile frame subscription failed')); }
  });
}

/** Exactly one steady 20-second page window on the already-entered world. */
export const STEADY_SCRIPT_WINDOW = `(${steadyScriptWindow.toString()})()`;

/** Start Safari's existing sampling protocol on the driving Inspector, returning a bounded stop operation.
 * Proxy timestamps can be zero, so callers delimit the page window explicitly and never give this timing credit.
 * @param {import('./frame-floor-script-profile.mjs').ScriptProfilePort} inspector
 * @param {number} waitMs
 */
export async function startScriptProfile(inspector, waitMs = 10000) {
  await ensureWebKitPageClock(inspector);
  /** @type {(value: unknown) => void} */
  let receive = () => undefined;
  const finished = new Promise(resolve => { receive = resolve; });
  const off = inspector.on('ScriptProfiler.trackingComplete', value => receive(value));
  try { await inspector.send('ScriptProfiler.startTracking', { includeSamples: true }); }
  catch (error) { off(); throw error; }
  return async () => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const deadline = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Safari sampling profile did not complete')), waitMs); });
    try { return await Promise.race([inspector.send('ScriptProfiler.stopTracking').then(() => finished), deadline]); }
    finally { clearTimeout(timer); off(); }
  };
}

/** Sample the opening twenty seconds of a drive without changing its inputs,
 * sampler or completion. Observe auto-stop failures immediately, then rethrow
 * them when the original drive releases its profile. No page timer or watcher.
 * @param {import('./frame-floor-script-profile.mjs').ScriptProfilePort} inspector
 * @param {(expression: string) => Promise<unknown>} evaluate
 * @param {(capture: {profile: unknown, pageRange: {startMs: number, endMs: number}}) => void} persist
 */
export async function startPrefixScriptProfile(inspector, evaluate, persist = () => undefined) {
  const stop = await startScriptProfile(inspector);
  let startMs;
  try {
    startMs = await evaluate('performance.now()');
    if (typeof startMs !== 'number' || !Number.isFinite(startMs)) throw new Error('Prefix profile has no start clock');
  } catch (error) { await stop().catch(() => undefined); throw error; }
  let stopping;
  const finish = async () => {
    if (stopping === undefined) stopping = (async () => {
      try {
        const profile = await stop(), endMs = await evaluate('performance.now()');
        if (typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs < startMs) throw new Error('Prefix profile has no end clock');
        const value = { profile, pageRange: { startMs, endMs } };
        persist(value); // durable before the rest of the drive can fail
        return { value };
      } catch (error) { return { error }; }
    })();
    const result = await stopping;
    if ('error' in result) throw result.error;
    return result.value;
  };
  const timer = setTimeout(() => { void finish().catch(() => undefined); }, 20000);
  return () => { clearTimeout(timer); return finish(); };
}
