(() => {
  const W = window;
  if (W.__pt && W.__pt.origin === performance.timeOrigin) return 'already';
  const pt = W.__pt = { origin: performance.timeOrigin, errors: [], log: [], trace: [], gaps: [], drive: null };
  W.addEventListener('error', (e) => { pt.errors.push([Math.round(performance.now()), String(e.message)]); });
  W.addEventListener('unhandledrejection', (e) => { pt.errors.push([Math.round(performance.now()), 'rej ' + String(e.reason && e.reason.stack || e.reason).slice(0, 300)]); });
  const ce = console.error.bind(console); console.error = (...a) => { if (pt.errors.length < 200) pt.errors.push([Math.round(performance.now()), 'console ' + a.map(String).join(' ').slice(0, 300)]); ce(...a); };
  let prev = 0; const raf = (t) => { if (prev && t - prev > 100) pt.gaps.push([Math.round(prev), Math.round(t - prev)]); prev = t; requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  const txt = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' || ').slice(0, 400);
  pt.snap = () => {
    const api = W.__wildshard; const o = { t: Math.round(performance.now()), href: location.pathname + location.search };
    try {
      const L = document.querySelector('.ws-load');
      if (L) o.load = { step: L.getAttribute('data-step'), dl: L.getAttribute('data-download'), setup: L.getAttribute('data-setup'), slug: L.querySelector('[data-el="slug"]')?.textContent, line: L.querySelector('[data-el="line"]')?.textContent, shown: getComputedStyle(L).display !== 'none' && Number(getComputedStyle(L).opacity) > 0.05 };
      o.err = document.getElementById('wserr')?.innerText?.slice(0, 300) ?? null;
      const g = api?.shard?.grid;
      if (g) { const s = g.state(); const l = s.live?.live; o.grid = { current: l?.current, inside: s.inside, feet: l?.worldFeet && { x: +l.worldFeet.x.toFixed(1), y: +(l.worldFeet.y ?? 0).toFixed(2), z: +l.worldFeet.z.toFixed(1) }, ready: l?.gameplayReady, residents: l?.residents, crossings: l?.crossings, phase: s.live?.crossing?.phase, issue: s.live?.crossing?.issue, playingMB: s.playingMB != null ? Math.round(s.playingMB) : null }; }
      const p = api?.world?.player; if (p) { o.player = { x: +p.position.x.toFixed(1), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(1), hover: p.hover, yaw: +(p.yaw ?? 0).toFixed(2) }; }
      o.budget = txt('.ws-grid-budget'); o.warn = txt('.ws-memory-warning'); o.perf = txt('.ws-perf');
      o.hoverBtn = (() => { const h = document.querySelector('.ws-touch-hover'); return h ? { vis: h.offsetParent !== null && getComputedStyle(h).visibility !== 'hidden' && getComputedStyle(h).display !== 'none', on: h.classList.contains('on') } : null; })();
      o.level = api?.world?.game?.level?.id ?? null;
      o.errs = pt.errors.length; o.maxGap = Math.max(0, ...pt.gaps.filter((g) => g[0] > o.t - 5000).map((g) => g[1]));
    } catch (e) { o.snapErr = String(e); }
    return o;
  };
  pt.tapHover = () => { const h = document.querySelector('.ws-touch-hover'); if (!h) return 'no button'; const r = h.getBoundingClientRect(); const ev = (type) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }); h.dispatchEvent(ev('pointerdown')); h.dispatchEvent(ev('pointerup')); return { on: h.classList.contains('on'), rect: [r.x, r.y, r.width, r.height].map(Math.round) }; };
  pt.press = (action) => { W.__wildshard.world.game.app.input.press(action); return true; };
  pt.stop = () => { if (pt.drive) pt.drive.stop(); };
  // waypoints in grid world feet coords; holds move.forward like a held joystick, steering yaw at each frame
  pt.go = (waypoints, opts = {}) => {
    pt.stop();
    const api = W.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    const d = pt.drive = { waypoints, i: 0, started: performance.now(), done: false, stuck: [], log: [], status: 'run' };
    let lastProg = performance.now(), lastPos = null, lastSample = 0;
    const unwatch = world.game.watchFrames(() => {
      try {
        if (d.done) return;
        const s = api.shard.grid.state(), l = s.live.live, f = l.worldFeet;
        const now = performance.now();
        if (now - lastSample > 500) { lastSample = now; pt.trace.push([Math.round(now), +f.x.toFixed(1), +f.z.toFixed(1), l.current, l.gameplayReady ? 1 : 0, s.playingMB != null ? Math.round(s.playingMB) : null, player.hover ? 1 : 0]); if (pt.trace.length > 4000) pt.trace.shift(); }
        const tgt = waypoints[d.i];
        if (!tgt) { input.clear(); d.done = true; d.status = 'arrived'; d.ended = now; return; }
        const dx = tgt.x - f.x, dz = tgt.z - f.z, dist = Math.hypot(dx, dz);
        if (dist < (tgt.r ?? 3)) { d.log.push([Math.round(now), 'wp', d.i, l.current]); d.i++; return; }
        if (!l.gameplayReady && !opts.ignoreReady) { input.clear(); lastProg = now; return; }
        if (!lastPos || Math.hypot(f.x - lastPos.x, f.z - lastPos.z) > 1.0) { lastPos = { x: f.x, z: f.z }; lastProg = now; }
        else if (now - lastProg > (opts.stuckMs ?? 5000)) { d.stuck.push([Math.round(now), +f.x.toFixed(1), +f.z.toFixed(1), l.current]); d.status = 'stuck'; d.done = true; input.clear(); return; }
        player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
      } catch (e) { d.status = 'error ' + String(e).slice(0, 200); d.done = true; try { input.clear(); } catch { } }
    });
    d.stop = () => { d.done = true; if (d.status === 'run') d.status = 'stopped'; try { unwatch(); } catch { } try { input.clear(); } catch { } };
    return 'driving';
  };
  pt.ds = () => { const d = pt.drive; return d ? { status: d.status, i: d.i, n: d.waypoints.length, stuck: d.stuck, log: d.log.slice(-6), secs: Math.round(((d.ended ?? performance.now()) - d.started) / 100) / 10 } : null; };
  return 'installed';
})()
