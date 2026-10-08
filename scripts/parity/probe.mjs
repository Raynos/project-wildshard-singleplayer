/** Harness-only compatibility for historical pages; never copies or retains the level world. */
export function installLegacyProbeAdapter() {
  document.addEventListener('ws:ready', () => {
    const probe = window.__wildshard;
    if (typeof Reflect.get(probe, 'requireWorld') === 'function') return;
    Reflect.set(probe, 'requireWorld', () => {
      const world = window.__wildshard.world;
      if (world === undefined) throw new Error('Debug level has retired');
      return world;
    });
  }, { once: true, capture: true });
}
