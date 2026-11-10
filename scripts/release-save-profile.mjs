// Passive save-boundary diagnosis. No document keys, values, retries or game clock.
export function observeReleaseSaveControl() {
  const evidence = { rows: [], dropped: 0, counts: {} }, ports = new WeakSet();
  Reflect.set(globalThis, '__releaseSaveControl', evidence);
  const original = MessagePort.prototype.postMessage;
  const known = new Set(['boot', 'save', 'write', 'written', 'saved']);
  const record = (direction, message) => {
    if (message === null || typeof message !== 'object' || !known.has(message.kind)) return;
    const kind = message.kind;
    evidence.counts[kind] = (evidence.counts[kind] ?? 0) + 1;
    const row = { at: Date.now(), direction, kind };
    for (const key of ['id', 'seq', 'tick']) if (Number.isSafeInteger(message[key])) row[key] = message[key];
    if (typeof message.ok === 'boolean') row.ok = message.ok;
    if (kind === 'write') {
      row.document = typeof message.key !== 'string' ? 'unknown'
        : /standalonesite(?:alt)?-/u.test(message.key) ? 'site' : /standalone(?:alt)?-/u.test(message.key) ? 'cell' : 'other';
      row.chars = typeof message.value === 'string' ? message.value.length : null;
    }
    if (evidence.rows.length === 128) { evidence.rows.shift(); evidence.dropped++; }
    evidence.rows.push(row);
  };
  MessagePort.prototype.postMessage = function (...args) {
    const message = args[0];
    if (message !== null && typeof message === 'object' && known.has(message.kind)) {
      if (!ports.has(this)) {
        ports.add(this);
        this.addEventListener('message', event => record('receive', event.data));
      }
      record('send', message);
    }
    return Reflect.apply(original, this, args);
  };
}

// Read the actual worker's failed SaveStore validation at its existing report
// method. Resume immediately; never change the value or suppress the refusal.
export async function watchReleaseSaveRefusals(browser, workerURL) {
  const root = await browser.newBrowserCDPSession(), pending = new Map(), scripts = [], breakpoints = new Map();
  const evidence = { reports: [], errors: [], methods: 0, dropped: 0 };
  let serial = 0, sessionId, stopping = false, detached = false;
  const refused = stage => { if (evidence.errors.length === 32) evidence.errors.shift(); evidence.errors.push(stage); };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('Save diagnosis RPC refused: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    void root.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => {
      pending.delete(id); clearTimeout(timer); reject(error);
    });
  });
  const resumed = new Set();
  const pause = async params => {
    try {
      const expression = (params.hitBreakpoints ?? []).map(id => breakpoints.get(id)).find(value => value !== undefined);
      if (expression !== undefined && !stopping) {
        const result = await send('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId, expression, returnByValue: true });
        if (result.exceptionDetails !== undefined) throw new Error('Save report projection refused');
        if (evidence.reports.length === 32) { evidence.dropped++; evidence.reports.shift(); }
        evidence.reports.push({ at: Date.now(), ...result.result.value });
      }
    } catch { refused('Save report projection refused'); }
    finally {
      await send('Debugger.resume').catch(async () => {
        refused('Resume refused; emergency detach attempted');
        try { await root.send('Target.detachFromTarget', { sessionId }); detached = true; }
        catch { refused('Emergency detach refused'); }
      });
    }
  };
  const receive = event => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message), waiter = pending.get(message.id);
    if (waiter !== undefined) {
      pending.delete(message.id); clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    } else if (message.method === 'Debugger.scriptParsed') scripts.push(message.params);
    else if (message.method === 'Debugger.paused') {
      const task = pause(message.params); resumed.add(task); void task.finally(() => resumed.delete(task));
    }
  };
  root.on('Target.receivedMessageFromTarget', receive);
  try {
    const { targetInfos } = await root.send('Target.getTargets');
    const targets = targetInfos.filter(row => row.type === 'worker' && row.url === workerURL);
    if (targets.length !== 1) throw new Error('Exact save worker target absent or ambiguous');
    ({ sessionId } = await root.send('Target.attachToTarget', { targetId: targets[0].targetId, flatten: false }));
    await send('Debugger.enable');
    for (const script of scripts) {
      if (!/\/standalone\/serverRuntime[^/]*\.js$/u.test(new URL(script.url).pathname)) continue;
      const { scriptSource } = await send('Debugger.getScriptSource', { scriptId: script.scriptId });
      const signature = /report\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)\)\{try\{/u.exec(scriptSource);
      if (signature === null || !scriptSource.slice(signature.index, signature.index + 250).includes('save-schema')) throw new Error('Actual SaveStore report method not identified');
      const offset = signature.index + signature[0].length;
      const prefix = scriptSource.slice(0, offset), lines = prefix.split('\n');
      const location = { scriptId: script.scriptId, lineNumber: lines.length - 1, columnNumber: lines.at(-1).length };
      const [, scope, key, version, issue] = signature;
      const expression = `(()=>{const text=String(${issue}),length=/^Invalid length: Expected <=(\\d+) but received (\\d+)$/i.exec(text);return {document:/standalonesite(?:alt)?-/.test(${scope})?'site':/standalone(?:alt)?-/.test(${scope})?'cell':'other',key:['continuation','continuationSite'].includes(${key})?${key}:'other',version:Number.isSafeInteger(${version})?${version}:null,issue:/^Invalid length/.test(text)?'length':/^Invalid type/.test(text)?'type':'other',length:length===null?null:{maximum:Number(length[1]),actual:Number(length[2])}}})()`;
      const { breakpointId, actualLocation } = await send('Debugger.setBreakpoint', { location });
      const sourceLines = scriptSource.split('\n');
      const actualOffset = sourceLines.slice(0, actualLocation.lineNumber).reduce((total, line) => total + line.length + 1, 0) + actualLocation.columnNumber;
      if (actualLocation.scriptId !== script.scriptId || actualOffset < offset || actualOffset >= scriptSource.indexOf('}catch', offset)) {
        await send('Debugger.removeBreakpoint', { breakpointId });
        throw new Error('Save report breakpoint moved outside its method');
      }
      breakpoints.set(breakpointId, expression); evidence.methods++;
    }
    if (evidence.methods !== 1) throw new Error('Expected one actual worker SaveStore report method');
  } catch { refused('Save diagnosis setup refused'); }
  return async () => {
    stopping = true;
    try {
      if (!detached) for (const breakpointId of breakpoints.keys()) await send('Debugger.removeBreakpoint', { breakpointId }).catch(() => { refused('Breakpoint removal refused'); });
      await Promise.all([...resumed]);
      if (sessionId !== undefined && !detached) await root.send('Target.detachFromTarget', { sessionId }).catch(() => { refused('Worker detach refused'); });
    } finally {
      root.off('Target.receivedMessageFromTarget', receive);
      for (const row of pending.values()) { clearTimeout(row.timer); row.reject(new Error('Save diagnosis retired')); }
      pending.clear(); await root.detach().catch(() => { refused('Root detach refused'); });
    }
    return evidence;
  };
}
