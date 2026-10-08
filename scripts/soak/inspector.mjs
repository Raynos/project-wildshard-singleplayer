// One Inspector connection for driving, passive events and opt-in settled heap snapshots.
import { WebSocket } from 'ws';

/** Target-aware protocol transport; heap snapshots need a larger payload and deadline than scalar reads. */
export function soakInspector(url, Socket = WebSocket) {
  const ws = new Socket(url, { maxPayload: 512 * 1024 * 1024 }), pending = new Map(), listeners = new Map();
  let serial = 0, target = null;
  const opened = new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const retire = () => {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('Inspector closed')); }
    pending.clear();
  };
  const receive = message => {
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id); clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    }
    if (message.method) for (const listener of listeners.get(message.method) ?? []) listener(message.params);
  };
  ws.on('message', data => {
    const message = JSON.parse(String(data));
    if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') target = message.params.targetInfo.targetId;
    else if (message.method === 'Target.didCommitProvisionalTarget') target = message.params.newTargetId;
    else if (message.method === 'Target.dispatchMessageFromTarget') receive(JSON.parse(message.params.message));
    else receive(message);
  });
  ws.on('close', retire); ws.on('error', retire);
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error(`Safari inspector timeout: ${method}`)); }, method === 'Heap.snapshot' ? 300000 : 10000);
    pending.set(id, { resolve, reject, timer });
    const message = { id, method, params };
    try { ws.send(JSON.stringify(target ? { id: ++serial, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } } : message)); }
    catch (error) { pending.delete(id); clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); }
  });
  return { opened, send,
    on(method, listener) {
      const set = listeners.get(method) ?? new Set(); set.add(listener); listeners.set(method, set);
      return () => { set.delete(listener); if (set.size === 0) listeners.delete(method); };
    },
    close() { retire(); listeners.clear(); ws.close(); },
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
      return result.result?.value;
    },
  };
}
