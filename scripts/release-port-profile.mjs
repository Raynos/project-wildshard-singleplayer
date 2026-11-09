// Diagnostic only: native movement/frame envelopes, never reliable user data.
// This function is serialized into the page and its actual server worker.
export function observeReleasePorts() {
  if (Reflect.has(globalThis, '__releasePortStop')) throw new Error('Native port observer already installed');
  const prototype = MessagePort.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, 'postMessage');
  if (original === undefined || typeof original.value !== 'function') throw new Error('Native MessagePort sender missing');
  const send = original.value, ports = new Map(), rows = [];
  let serial = 0, overflow = false, stopped = false;
  const envelope = value => typeof value === 'object' && value !== null
    && value.channel === 'unreliable' && value.bytes instanceof ArrayBuffer;
  const record = (port, direction, data) => {
    if (!envelope(data)) return;
    if (rows.length === 50_000) { overflow = true; return; }
    const header = Array.from(new Uint8Array(data.bytes, 0, Math.min(64, data.bytes.byteLength)));
    rows.push({ at: performance.timeOrigin + performance.now(), port, direction, length: data.bytes.byteLength, header });
  };
  function observed(...args) {
    const [data] = args;
    if (envelope(data)) {
      let port = ports.get(this);
      if (port === undefined) {
        const id = ++serial;
        const receive = event => record(id, 'receive', event.data);
        port = { id, receive }; ports.set(this, port);
        this.addEventListener('message', receive);
      }
      record(port.id, 'send', data);
    }
    return Reflect.apply(send, this, args);
  }
  Object.defineProperty(prototype, 'postMessage', { ...original, value: observed });
  const stop = () => {
    if (stopped) throw new Error('Release port observer already stopped');
    stopped = true;
    const current = Object.getOwnPropertyDescriptor(prototype, 'postMessage');
    if (current?.value !== observed) throw new Error('Native port observer changed during capture');
    Object.defineProperty(prototype, 'postMessage', original);
    for (const [port, row] of ports) port.removeEventListener('message', row.receive);
    return { protocol: 'release-native-port/1', overflow, ports: ports.size, rows };
  };
  Reflect.set(globalThis, '__releasePortStop', stop);
}

export function finishReleasePorts() {
  const stop = Reflect.get(globalThis, '__releasePortStop');
  if (typeof stop !== 'function') throw new Error('Native port observer missing');
  const result = stop();
  Reflect.deleteProperty(globalThis, '__releasePortStop');
  return result;
}
