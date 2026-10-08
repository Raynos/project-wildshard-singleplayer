/** Record exact mutations through boot and drive, including when long tasks block the one-second timer. */
export function installLoadingGlJournal() {
  const key = 'sf57.loading-gl-journal';
  const documentId = window.__sf57DocumentId ??= `${Date.now()}:${Math.random()}`;
  window.__sf57GLEvents = JSON.parse(sessionStorage.getItem(key) ?? '[]');
  sessionStorage.removeItem(key);
  let sequence = 0;
  const push = row => window.__sf57GLEvents.push({ ...row, document: documentId, sequence: sequence++ });
  push({ op: 'begin', at: Date.now() / 1000 });
  window.__sc_gl_change = push;
  window.__sf57MarkGLCycle = cycle => {
    if (window.__sc_gl_change !== push || !Number.isSafeInteger(cycle) || cycle < 0) throw new Error('Invalid GL journal cycle');
    window.__sf57 = { ...window.__sf57, cycles: cycle };
    push({ op: 'cycle', at: Date.now() / 1000, cycle });
  };
  window.__sf57StopGLJournal = () => {
    if (window.__sc_gl_change !== push) return;
    push({ op: 'stop', at: Date.now() / 1000 }); window.__sc_gl_change = null;
  };
  // Page lifetime, installed before game boot. Persist the tail through the ordinary title navigation.
  window.addEventListener('pagehide', () => {
    if (window.__sc_gl_change !== push) return;
    push({ op: 'end', at: Date.now() / 1000 }); window.__sc_gl_change = null;
    sessionStorage.setItem(key, JSON.stringify(window.__sf57GLEvents));
  }, { once: true });
}

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
      current: grid?.live?.live?.current ?? null, inside: grid?.inside ?? null,
      residents: grid?.live?.live?.residents ?? [],
      wasm: (window.__sf57Wasm ?? []).map(({ name, source, memory }) => ({ name, source, bytes: memory.deref()?.buffer.byteLength ?? 0 })),
      settled: grid !== undefined && grid.rings?.inFlight === 0 && grid.rings.queued === 0
        && grid.live?.live?.pending?.length === 0 && grid.live.live.gameplayReady === true,
      cycle: window.__sf57?.cycles ?? null };
  };
  window.__sf57GLTimer = setInterval(() => { window.__sf57GL.push(window.__sf57ReadGL()); if (window.__sf57GL.length > 120) window.__sf57GL.shift(); }, 1000);
  window.addEventListener('webglcontextlost', () => { window.__sf57Errors.push('WebGL context lost'); }, true);
}

/** Observe weak WASM capacities before boot; never add them to the WC+GL ruler. */
export function installSoakWasm() {
  // Weak telemetry records WASM capacity without keeping retired instances alive or counting it twice.
  const wasm = window.WebAssembly;
  window.__sf57Wasm = [];
  const record = (instance, source) => {
    for (const [name, memory] of Object.entries(instance.exports)) if (memory instanceof wasm.Memory
      && !window.__sf57Wasm.some(row => row.memory.deref() === memory)) window.__sf57Wasm.push({ name, source, memory: new WeakRef(memory) });
  };
  for (const name of ['instantiate', 'instantiateStreaming']) {
    const original = wasm[name];
    wasm[name] = function observeWasm(...args) { return original.apply(this, args).then(result => { record(result.instance ?? result, name); return result; }); };
  }
  wasm.Instance = new Proxy(wasm.Instance, { construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget); record(instance, 'Instance'); return instance;
  } });
}
