// page.waitForFunction polls synchronous truthiness, so an async predicate
// can finish before its promised condition. Await worker readiness explicitly.
export function waitForReleaseWorker(page, timeout = 90_000) {
  return page.evaluate(timeout => new Promise((resolve, reject) => {
    let active, settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      active?.removeEventListener('statechange', inspect);
      if (error === undefined) resolve(); else reject(error);
    };
    const inspect = () => {
      if (active?.state === 'activated') finish();
      else if (active?.state === 'redundant') finish(new Error('Release worker became redundant'));
    };
    const deadline = setTimeout(() => finish(new Error('Release worker activation timed out')), timeout);
    if (navigator.serviceWorker === undefined) { finish(new Error('Service workers unavailable')); return; }
    navigator.serviceWorker.ready.then(registration => {
      if (settled) return;
      active = registration.active;
      if (active === null) { finish(new Error('Release worker has no active registration')); return; }
      active.addEventListener('statechange', inspect);
      inspect();
    }).catch(error => finish(error ?? new Error('Release worker readiness rejected')));
  }), timeout);
}

// Finish actual page module transfers before deliberately reloading it. WebKit
// reports aborted dynamic imports from the outgoing page as page errors.
// Observe transport completion rather than suppressing any of those errors.
export function observeReleaseModules(page) {
  const pending = new Set(), waiters = new Set();
  const changed = () => { for (const waiter of waiters) waiter.check(); };
  const started = request => {
    if (request.resourceType() !== 'script' && !/\/b\/[^?#]+\.js(?:[?#]|$)/u.test(request.url())) return;
    pending.add(request); changed();
  };
  const finished = request => { if (pending.delete(request)) changed(); };
  page.on('request', started);
  page.on('requestfinished', finished);
  page.on('requestfailed', finished);
  return {
    wait: (timeout = 90_000, quiet = 100) => new Promise((resolve, reject) => {
      let quietTimer, deadline, settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(deadline); clearTimeout(quietTimer); waiters.delete(waiter);
        if (error === undefined) resolve(); else reject(error);
      };
      const waiter = {
        check: () => { clearTimeout(quietTimer); if (pending.size === 0) quietTimer = setTimeout(() => finish(), quiet); },
        cancel: () => finish(new Error('Release module observer closed')),
      };
      deadline = setTimeout(() => finish(new Error('Release page modules did not settle')), timeout);
      waiters.add(waiter); waiter.check();
    }),
    dispose: () => {
      page.off('request', started); page.off('requestfinished', finished); page.off('requestfailed', finished);
      for (const waiter of waiters) waiter.cancel();
      pending.clear();
    },
  };
}
