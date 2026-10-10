/** Pin the real capture clock before bootstrap and retain each actor/group on its first observed frame.
 * A fixed 0.1 ms boot quantum observes first sight before the first 60 Hz motor step, matching the tick-zero roster.
 * RAF timestamps may vary; no saved field is rounded or removed.
 * This function is passed to Playwright, so it must contain every browser-side dependency it uses.
 */
export function installNalatiPhysicsCapture() {
  window.__wildshardHarness = { seed: 0x4a1a, capture: 10_000 };
  const seen = new Map(), groups = new Map(), flocks = new Map(), raf = window.requestAnimationFrame.bind(window);
  window.__nalatiSpawns = seen; window.__nalatiGroups = groups; window.__nalatiFlocks = flocks; window.__nalatiMarmots = null;
  window.requestAnimationFrame = onFrame => raf(time => {
    for (const a of window.__wildshard?.world?.animals?.animals ?? []) {
      if (!seen.has(a.entityId)) seen.set(a.entityId, { id: a.entityId, at: [a.position.x, a.position.y, a.position.z], yaw: a.yaw, mem: { ...a.mem } });
    }
    const wildlife = window.__wildshard?.world?.game?.app?.debug?.snapshot?.().nalati?.wildlife;
    if (window.__nalatiMarmots === null && wildlife?.marmots !== null && wildlife?.marmots !== undefined) window.__nalatiMarmots = wildlife.marmots.tickZero;
    for (const [kind, list] of [['pack', wildlife?.packs ?? []], ['herd', wildlife?.herds ?? []]]) list.forEach((group, i) => {
      const key = `${kind}:${i}`;
      if (!groups.has(key)) groups.set(key, { kind, members: group.members.map(m => m.entityId), state: group.snapshot() });
    });
    (wildlife?.flocks ?? []).forEach((flock, i) => {
      if (flocks.has(i)) return;
      const point = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
      flocks.set(i, { n: flock.n, cx: flock.cx, cz: flock.cz, members: Array.from({ length: flock.n }, (_, index) => {
        const p = flock.positions(index, point); return { at: [p.x, p.y, p.z], yaw: flock.headingOf(index) };
      }) });
    });
    onFrame(time);
  });
}
