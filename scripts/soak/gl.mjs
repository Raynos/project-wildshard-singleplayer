/** Called before boot, after GL_INIT. Live API allocations are labelled; GPU-process footprint is separate. */
export function installSoakGl() {
  window.__sf57GL = [];
  window.__sf57ReadGL = () => {
    const contexts = window.__sc_gl(), groups = new Map();
    for (const context of contexts) for (const resource of context.resources) {
      const key = `${resource.owner}\0${resource.asset}`, group = groups.get(key) ?? { owner: resource.owner, asset: resource.asset, bytes: 0, resources: 0 };
      group.bytes += resource.bytes; group.resources++; groups.set(key, group);
    }
    const grid = window.__wildshard?.shard?.grid?.state();
    return { at: Date.now() / 1000, totalBytes: contexts.reduce((sum, context) => sum + context.totalBytes, 0),
      textures: contexts.reduce((sum, context) => sum + context.texBytes, 0), renderbuffers: contexts.reduce((sum, context) => sum + context.rbBytes, 0), buffers: contexts.reduce((sum, context) => sum + context.bufBytes, 0),
      unlabelled: contexts.reduce((sum, context) => sum + context.unlabelled, 0), reconciled: contexts.every((context) => context.reconciled),
      assets: [...groups.values()].sort((a, b) => b.bytes - a.bytes || a.asset.localeCompare(b.asset)),
      accountedBytes: grid?.accountedBytes ?? null,
      settled: grid !== undefined && grid.rings?.inFlight === 0 && grid.rings.queued === 0
        && grid.live?.live?.pending?.length === 0 && grid.live.live.gameplayReady === true,
      cycle: window.__sf57?.cycles ?? null };
  };
  window.__sf57GLTimer = setInterval(() => { window.__sf57GL.push(window.__sf57ReadGL()); if (window.__sf57GL.length > 120) window.__sf57GL.shift(); }, 1000);
  window.addEventListener('webglcontextlost', () => { window.__sf57Errors.push('WebGL context lost'); }, true);
}
