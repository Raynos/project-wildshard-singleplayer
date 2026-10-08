(async()=>{function sample(n) {
  const g = window.__wildshard.world.game, meter = g.app?.cpu;
  if (!meter) return Promise.reject(new Error('Content CPU meter unavailable; use an SF62-capable pin'));
  meter.enabled = false;
  return new Promise((resolve, reject) => {
    const interval = [], callbackInterval = [], ring = [], work = [], calls = [], triangles = [], cpuOwners = new Map();
    let cpuFrames = 0, cpuFrame = -1;
    let count = g.frameCount, last = 0, lastCallback = 0, skipped = 0, first = true;
    let raf = 0;
    const timeout = setTimeout(() => { cancelAnimationFrame(raf); reject(new Error(`Drawn-frame sampler stalled (${interval.length}/${n})`)); }, 30000);
    const tick = (timestamp) => {
      const now = performance.now();
      if (g.frameCount !== count) {
        const delta = g.frameCount - count;
        if (!first) {
          // rAF's shared vsync timestamp grades drawn cadence; callback time also includes preceding game work.
          interval.push(timestamp - last); callbackInterval.push(now - lastCallback); skipped += Math.max(0, delta - 1);
          const i = (g.frameI + g.frameMs.length - 1) % g.frameMs.length;
          ring.push(g.frameMs[i]); work.push(g.workMs[i]); calls.push(g.lastFrame.calls); triangles.push(g.lastFrame.triangles);
          const cpu = meter.snapshot();
          if (cpu.enabled && cpu.frame > cpuFrame && cpu.owners.length > 0) {
            cpuFrame = cpu.frame; cpuFrames++;
            for (const owner of cpu.owners) {
              if (!cpuOwners.has(owner.id)) cpuOwners.set(owner.id, { ms: [], calls: 0 });
              const row = cpuOwners.get(owner.id); row.ms.push(owner.ms); row.calls += owner.calls;
            }
          }
        }
        first = false; count = g.frameCount; last = timestamp; lastCallback = now;
      }
      if (interval.length < n) { raf = requestAnimationFrame(tick); return; }
      clearTimeout(timeout);
      const pct = (v, p) => { const sorted = [...v].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]; };
      const round = (v) => Math.round(v * 1000) / 1000;
      resolve({ frames: interval.length, skipped, medianFps: round(1000 / pct(interval, 0.5)), p50Ms: round(pct(interval, 0.5)),
        p95Ms: round(pct(interval, 0.95)), p99Ms: round(pct(interval, 0.99)), maxMs: round(pct(interval, 1)),
        callbackP95Ms: round(pct(callbackInterval, 0.95)), callbackP99Ms: round(pct(callbackInterval, 0.99)), callbackMaxMs: round(pct(callbackInterval, 1)),
        gameP95Ms: round(pct(ring, 0.95)), workP95Ms: round(pct(work, 0.95)), calls: pct(calls, 0.5), triangles: pct(triangles, 0.5),
        position: { x: window.__wildshard.world.player.position.x, y: window.__wildshard.world.player.position.y, z: window.__wildshard.world.player.position.z },
        cpu: { enabled: meter.snapshot().enabled, frames: cpuFrames, owners: [...cpuOwners].map(([id, row]) => ({ id, samples: row.ms.length, p95Ms: pct(row.ms, 0.95), maxMs: pct(row.ms, 1), calls: row.calls })) },
        contextLost: g.renderer.getContext().isContextLost() });
    };
    raf = requestAnimationFrame(tick);
  });
}


return await sample(120)})()