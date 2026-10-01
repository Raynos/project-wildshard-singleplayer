/** Harness-only rAF driver: one 30 Hz timestamp per callback batch, scheduled by GPU/task throughput.
 * Native rAF remains the idle scheduler; the driver never changes the game's capture dt or input steps.
 * @param {{accelerated:boolean}} opts */
export function installFrameDriver(opts) {
  if (!opts.accelerated) return;
  const control = window.__parity, nativeRAF = window.requestAnimationFrame.bind(window), nativeCancel = window.cancelAnimationFrame.bind(window);
  const channel = new MessageChannel(), callbacks = new Map(), observers = new Set();
  let ready = false, nextId = -1, timestamp = performance.now(), nativeId = 0, posted = false, waiting = 0;
  /** @type {(() => void)|undefined} */ let finish;
  const active = () => ready && (control.free || control.remaining > 0 || waiting > 0);
  const wake = () => {
    if (callbacks.size === 0) return;
    if (active()) {
      if (nativeId) { nativeCancel(nativeId); nativeId = 0; }
      if (!posted) { posted = true; channel.port2.postMessage(null); }
    } else if (!nativeId && !posted) nativeId = nativeRAF(tick);
  };
  function tick() {
    posted = false; nativeId = 0;
    timestamp = Math.max(timestamp + 1000 / 30, performance.now());
    const drawn=()=>ready?Number(Reflect.get(window.__wildshard.world.game,'frameNo')):0, before=drawn();
    const batch = [...callbacks]; callbacks.clear();
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- rAF callbacks are the browser API being driven, not promise continuations.
    for (const [, callback] of batch) { const start=performance.now(); callback(timestamp); if(control.on)control.cpu+=performance.now()-start; }
    if(drawn()!==before)for (const observer of observers) observer();
    if (waiting > 0 && --waiting === 0) { finish?.(); finish = undefined; }
    wake();
  }
  channel.port1.onmessage = tick;
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Preserve the browser rAF API while scheduling fixed capture frames.
  window.requestAnimationFrame = (callback) => { const id = nextId--; callbacks.set(id, callback); wake(); return id; };
  window.cancelAnimationFrame = (id) => { if (id < 0) callbacks.delete(id); else nativeCancel(id); };
  control.observe = (fn) => { observers.add(fn); return () => { observers.delete(fn); }; };
  control.wait = async (frames) => {
    if (!Number.isInteger(frames) || frames < 0 || waiting > 0) throw new Error('invalid concurrent frame wait');
    if (frames === 0) return;
    waiting = frames; await new Promise((resolve) => { finish = () => resolve(undefined); wake(); });
  };
  document.addEventListener('ws:ready', () => {
    ready = true;
    control.advance = async (frames) => {
      if (!Number.isInteger(frames) || frames < 0 || control.remaining > 0 || control.free) throw new Error('invalid concurrent frame advance');
      if (frames === 0) return;
      const game = window.__wildshard.world.game, end = Number(Reflect.get(game, 'frameNo')) + frames;
      control.remaining = frames;
      await new Promise((resolve) => {
        const check = () => { if (Number(Reflect.get(game, 'frameNo')) >= end) { observers.delete(check); resolve(undefined); } };
        observers.add(check); wake();
      });
    };
    wake();
  }, { once: true });
}
