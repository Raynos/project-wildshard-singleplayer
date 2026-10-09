/** Keep bounded scalar console/loss evidence through a refused navigation, without preventing recovery. */
export function installSoakDiagnostics() {
  const key = 'sf57.diagnostics', document = window.__sf57DocumentId;
  window.__sf57Diagnostics = JSON.parse(sessionStorage.getItem(key) ?? '[]');
  sessionStorage.removeItem(key);
  let sequence = 0;
  const record = (kind, details) => {
    window.__sf57Diagnostics.push({ at: Date.now() / 1000, document, sequence: sequence++, kind, ...details });
    if (window.__sf57Diagnostics.length > 128) window.__sf57Diagnostics.shift();
  };
  const state = () => {
    try {
      const grid = window.__wildshard?.shard?.grid?.state(), current = grid?.live?.runtimeTiming?.current;
      return { inside: grid?.inside ?? null, current: grid?.live?.live?.current ?? null,
        pending: (grid?.live?.live?.pending ?? []).map(value => String(value).slice(0, 128)),
        admitting: current ? { instance: current.instance, hook: current.hook, start: current.start } : null };
    } catch (error) { return { stateError: String(error).slice(0, 2000) }; }
  };
  for (const method of ['log', 'info', 'warn', 'error']) {
    const original = window.console[method];
    window.console[method] = (...args) => {
      record('console', { method, text: args.map(value => String(value).slice(0, 2000)).join(' ').slice(0, 4000) });
      return original.apply(window.console, args);
    };
  }
  window.addEventListener('webglcontextlost', event => {
    const game = window.__wildshard?.world?.game;
    record('contextlost', { ...state(), gameCanvas: event.target === game?.canvas,
      target: { tag: event.target?.tagName ?? null, id: event.target?.id ?? null, connected: event.target?.isConnected ?? null },
      status: String(event.statusMessage ?? '').slice(0, 2000) });
  }, true);
  window.addEventListener('pagehide', event => {
    record('pagehide', { ...state(), persisted: event.persisted });
    sessionStorage.setItem(key, JSON.stringify(window.__sf57Diagnostics));
  }, { once: true });
}

/** Record exact mutations through boot and drive, including when long tasks block the one-second timer. */
export function installLoadingGlJournal() {
  const key = 'sf57.loading-gl-journal';
  const documentId = window.__sf57DocumentId ??= `${Date.now()}:${Math.random()}`;
  window.__sf57GLEvents = JSON.parse(sessionStorage.getItem(key) ?? '[]');
  sessionStorage.removeItem(key);
  let sequence = 0;
  // Optional short entry diagnostics keep storage calls, including same-sized uploads.
  // The exact state journal below still coalesces unchanged allocations. Overflow is explicit.
  const uploadKey = 'sf57.uploads', previousUploads = JSON.parse(sessionStorage.getItem(uploadKey) ?? '{"rows":[],"overflow":0}');
  sessionStorage.removeItem(uploadKey);
  window.__sf57GLUploads = previousUploads.rows; window.__sf57UploadOverflow = previousUploads.overflow;
  let uploadSequence = 0;
  const callSites = new Set();
  // Renderer draw hooks repeat labels each frame. Keep exact state changes, not those unchanged assertions.
  const labels = new Map(), allocations = new Map();
  const push = row => {
    if (window.__sf57TraceUploads === true && row.op === 'allocation' && typeof row.bytes === 'number'
      && ['bufferData', 'texImage2D', 'texImage3D', 'copyTexImage2D', 'compressedTexImage2D',
        'compressedTexImage3D', 'texStorage2D', 'texStorage3D', 'generateMipmap', 'renderbufferStorage', 'renderbufferStorageMultisample'].includes(row.operation)) {
      if (window.__sf57GLUploads.length < 10000) {
        // One scalar stack per operation/second during travel, at most 128 per document.
        // Never capture one stack per texture/mip, retain GL objects or issue another GL query.
        const site = `${row.context}:${row.stage}:${row.operation}:${Math.floor(row.at)}`;
        let callSite;
        if (row.stage === 'travel' && callSites.size < 128 && !callSites.has(site)) {
          callSites.add(site); callSite = (new Error('SF57 storage call site').stack ?? '').slice(0, 6000);
        }
        window.__sf57GLUploads.push({ ...row, ...(callSite === undefined ? {} : { callSite }), document: documentId, uploadSequence: uploadSequence++ });
      }
      else window.__sf57UploadOverflow++;
    }
    if (row.op === 'label') {
      const previous = labels.get(row.id);
      if (previous?.owner === row.owner && previous.asset === row.asset) return;
      labels.set(row.id, { owner: row.owner, asset: row.asset });
    } else if (row.op === 'allocation') {
      const previous = allocations.get(row.id);
      if (row.bytes === null) {
        allocations.delete(row.id); labels.delete(row.id);
        if (previous === undefined) return;
      } else {
        if (previous && ['bytes', 'kind', 'context', 'owner', 'asset', 'labelled'].every(field => previous[field] === row[field])) return;
        allocations.set(row.id, { bytes: row.bytes, kind: row.kind, context: row.context, owner: row.owner, asset: row.asset, labelled: row.labelled });
      }
    }
    window.__sf57GLEvents.push({ ...row, document: documentId, sequence: sequence++ });
  };
  push({ op: 'begin', at: Date.now() / 1000 });
  window.__sc_gl_change = push;
  window.__sf57GLPosition = () => ({ document: documentId, sequence: sequence - 1 });
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
    if (window.__sf57TraceUploads === true) sessionStorage.setItem(uploadKey, JSON.stringify({
      rows: window.__sf57GLUploads.slice(-1000), overflow: window.__sf57UploadOverflow + Math.max(0, window.__sf57GLUploads.length - 1000),
    }));
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
      unlabelledBytes: contexts.reduce((sum, context) => sum + context.resources.reduce((bytes, resource) => bytes + (resource.labelled ? 0 : resource.bytes), 0), 0),
      journal: window.__sf57GLPosition?.() ?? null,
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
